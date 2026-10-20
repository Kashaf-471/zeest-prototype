"""Ownership, source snapshots and transactional clinical review services.

The request owns the transaction. No clinical service calls a hosted model.
"""

import json
from sqlalchemy import select, update
from fastapi import HTTPException
from db import Patient, Encounter, Input, Draft, Decision, Audit
from fixtures import SCENARIOS, findings, evidence


def fail(code, message):
    raise HTTPException(code, message)


def own_patient(s, pid, u):
    p = s.get(Patient, pid)
    if not p or p.physician_id != u.id:
        fail(404, "Patient not found.")
    return p


def own_encounter(s, eid, u):
    e = s.get(Encounter, eid)
    if not e:
        fail(404, "Encounter not found.")
    own_patient(s, e.patient_id, u)
    return e


def audit(s, u, e, action, revision=None, detail=""):
    s.add(
        Audit(
            physician_id=u.id,
            patient_id=e.patient_id,
            encounter_id=e.id,
            action=action,
            revision_id=revision,
            detail=detail,
        )
    )


def data(row):
    return {
        c.name: getattr(row, c.name)
        for c in row.__table__.columns
        if c.name not in ("password", "file")
    }


def inputs(s, eid):
    return list(
        s.scalars(select(Input).where(Input.encounter_id == eid).order_by(Input.id))
    )


def latest(s, eid):
    return s.scalar(
        select(Draft).where(Draft.encounter_id == eid).order_by(Draft.id.desc())
    )


def snapshot(s, e):
    return {
        "patient_id": e.patient_id,
        "encounter_id": e.id,
        "source_version": e.version,
        "input_revisions": [data(x) for x in inputs(s, e.id)],
        "history": [
            {
                "encounter_id": x.id,
                "date": x.date,
                "sources": [data(i) for i in inputs(s, x.id)],
                "approved_decisions": [
                    data(d)
                    for d in s.scalars(
                        select(Decision).where(Decision.encounter_id == x.id)
                    )
                ],
            }
            for x in s.scalars(
                select(Encounter).where(Encounter.patient_id == e.patient_id)
            )
        ],
    }


def touch(s, e):
    s.execute(
        update(Encounter)
        .where(Encounter.id == e.id)
        .values(version=Encounter.version + 1)
    )
    s.flush()
    s.refresh(e)


def lock_revision(s, eid, u):
    e = own_encounter(s, eid, u)
    # A write serialises SQLite review operations before the latest-revision read.
    s.execute(
        update(Encounter).where(Encounter.id == eid).values(version=Encounter.version)
    )
    s.refresh(e)
    return e


def generate_draft(s, eid, u, b):
    e = lock_revision(s, eid, u)
    case = snapshot(s, e)
    if not case["input_revisions"]:
        fail(422, "Save case inputs first.")
    fixture = SCENARIOS[b.scenario]
    case["findings"] = findings(inputs(s, eid), b.scenario)
    d = Draft(
        encounter_id=eid,
        scenario=b.scenario,
        diagnosis=fixture["diagnosis"],
        treatment=fixture["treatment"],
        snapshot=json.dumps(case),
        evidence=json.dumps(evidence(b.scenario)),
        critic="Simulated critic: this is a fixed scenario, not an assessment of the supplied audio or arbitrary uploads. Verify every statement. Clinical safety is not validated.",
    )
    s.add(d)
    s.flush()
    audit(s, u, e, "GENERATE", d.id, b.scenario)
    return data(d)


def review_draft(s, eid, u, b):
    e = lock_revision(s, eid, u)
    d = latest(s, eid)
    if not d or d.id != b.revision_id:
        fail(409, "Stale draft revision. Reload the current draft.")
    if b.action == "APPROVE" and d.status == "APPROVED":
        return {
            "draft": data(d),
            "decision": data(
                s.scalar(select(Decision).where(Decision.draft_id == d.id))
            ),
        }
    if d.status != "PENDING":
        fail(409, "Only a pending draft may be reviewed. Generate a new draft.")
    if json.loads(d.snapshot)["source_version"] != e.version:
        fail(
            409,
            "Source inputs changed after this draft. Generate a new draft before review.",
        )
    if b.action == "MODIFY":
        if not b.diagnosis.strip() or not b.treatment.strip():
            fail(422, "Diagnosis and treatment must both contain text.")
        new = Draft(
            encounter_id=eid,
            parent_id=d.id,
            scenario=d.scenario,
            diagnosis=b.diagnosis.strip(),
            treatment=b.treatment.strip(),
            snapshot=d.snapshot,
            evidence=d.evidence,
            critic="Simulated critic carried forward as context only. Physician edits have not been clinically re-evaluated. "
            + d.critic,
        )
        s.add(new)
        s.flush()
        audit(s, u, e, "MODIFY", new.id, f"Previous revision {d.id}")
        return {"draft": data(new)}
    d.status = "APPROVED" if b.action == "APPROVE" else "REJECTED"
    audit(s, u, e, b.action, d.id, b.reason)
    if b.action == "APPROVE":
        decision = Decision(
            encounter_id=eid,
            draft_id=d.id,
            content=json.dumps(
                {
                    "diagnosis": d.diagnosis,
                    "treatment": d.treatment,
                    "scenario": d.scenario,
                    "simulated": True,
                }
            ),
        )
        s.add(decision)
        s.flush()
        return {"draft": data(d), "decision": data(decision)}
    return {"draft": data(d)}
