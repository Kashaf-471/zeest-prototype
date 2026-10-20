"""Physician-owned overview for dashboard and cross-encounter navigation."""

from sqlalchemy import select
from db import Patient, Encounter, Draft, Decision, Audit, Input
from services import data


def overview(session, physician):
    patients = list(
        session.scalars(select(Patient).where(Patient.physician_id == physician.id))
    )
    patient_map = {p.id: p for p in patients}
    encounters = list(
        session.scalars(
            select(Encounter)
            .where(Encounter.patient_id.in_(patient_map))
            .order_by(Encounter.date.desc(), Encounter.id.desc())
        )
    )
    encounter_map = {e.id: e for e in encounters}
    drafts = list(
        session.scalars(
            select(Draft)
            .where(Draft.encounter_id.in_(encounter_map))
            .order_by(Draft.id.desc())
        )
    )
    latest = {}
    for draft in drafts:
        latest.setdefault(draft.encounter_id, draft)
    decisions = list(
        session.scalars(
            select(Decision)
            .where(Decision.encounter_id.in_(encounter_map))
            .order_by(Decision.id.desc())
        )
    )
    events = list(
        session.scalars(
            select(Audit)
            .where(Audit.physician_id == physician.id)
            .order_by(Audit.id.desc())
            .limit(12)
        )
    )
    sources = list(
        session.scalars(select(Input).where(Input.encounter_id.in_(encounter_map)))
    )
    rows = []
    for encounter in encounters:
        draft = latest.get(encounter.id)
        rows.append(
            dict(
                data(encounter),
                patient_name=patient_map[encounter.patient_id].name,
                draft_status=draft.status if draft else None,
                draft_id=draft.id if draft else None,
                source_count=sum(i.encounter_id == encounter.id for i in sources),
            )
        )

    def context(row):
        e = encounter_map[row.encounter_id]
        return dict(
            data(row),
            patient_id=e.patient_id,
            patient_name=patient_map[e.patient_id].name,
            encounter_date=e.date,
        )

    return {
        "patients": [
            dict(data(p), encounter_count=sum(e.patient_id == p.id for e in encounters))
            for p in patients
        ],
        "encounters": rows,
        "decisions": [context(d) for d in decisions],
        "activity": [context(a) for a in events if a.encounter_id in encounter_map],
        "metrics": {
            "patients": len(patients),
            "encounters": len(encounters),
            "pending": sum(d.status == "PENDING" for d in latest.values()),
            "approved": len(decisions),
        },
    }
