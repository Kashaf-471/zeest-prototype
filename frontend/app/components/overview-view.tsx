"use client";
import Link from "next/link";
import {
  Icon,
  Avatar,
  Status,
  PageHeading,
  Empty,
  Tip,
  EncounterRows,
  formatDate,
  actionLabels,
} from "./ui";
export function OverviewView({ m }: { m: any }) {
  const data = m.overview,
    metrics = data?.metrics || {
      patients: 0,
      encounters: 0,
      pending: 0,
      approved: 0,
    };
  const filtered = m.patients.filter((p: any) =>
    (p.name + " " + p.id + " " + p.info)
      .toLowerCase()
      .includes(m.query.toLowerCase()),
  );
  const decisions =
    data?.decisions.filter((d: any) =>
      (d.patient_name + d.content)
        .toLowerCase()
        .includes(m.query.toLowerCase()),
    ) || [];
  const pending =
    data?.encounters.filter((e: any) => e.draft_status === "PENDING") || [];
  if (m.route === "/guide") return <Guide />;
  if (!data)
    return (
      <div
        className="skeleton-panel"
        role="status"
        aria-label="Loading workspace overview"
      />
    );
  if (m.route === "/reviews")
    return (
      <>
        <PageHeading
          eyebrow="Clinical worklist"
          title="Review Queue"
          description="Saved drafts awaiting your review. Only explicit approval adds a clinical decision."
        />
        <div className="panel">
          <div className="panel-heading">
            <h2>Awaiting review</h2>
            <span className="count-tag">{pending.length}</span>
          </div>
          {pending.length ? (
            <EncounterRows items={pending} review />
          ) : (
            <Empty
              icon="review"
              title="Your review queue is clear"
              description="Generate a draft from an encounter when the notes and clinical inputs are ready."
              action={
                <Link href="/patients" className="btn primary">
                  Open My Patients <Icon name="arrow" size={16} />
                </Link>
              }
            />
          )}
        </div>
      </>
    );
  if (m.route === "/records")
    return (
      <>
        <PageHeading
          eyebrow="Longitudinal records"
          title="Patient Records"
          description="Approved clinical decisions across your patients. Open an encounter for its full audit trail."
        />
        <div className="searchbar">
          <Icon name="search" />
          <input
            aria-label="Search approved decisions"
            placeholder="Search by patient name or decision..."
            value={m.query}
            onChange={(e) => m.setQuery(e.target.value)}
          />
        </div>
        <div className="panel">
          {!data?.decisions.length ? (
            <Empty
              icon="records"
              title="No approved decisions yet"
              description="Decisions appear here after you review a saved draft and confirm approval."
              action={
                <Link href="/reviews" className="btn">
                  Open Review Queue <Icon name="arrow" size={16} />
                </Link>
              }
            />
          ) : decisions.length === 0 ? (
            <Empty
              icon="search"
              title="No matching decisions"
              description="Try another patient name or clear your search."
              action={
                <button onClick={() => m.setQuery("")}>Clear search</button>
              }
            />
          ) : (
            <div className="decision-list">
              {decisions.map((d: any) => (
                <article className="decision-card" key={d.id}>
                  <div className="toolbar">
                    <div className="identity">
                      <Avatar name={d.patient_name} />
                      <div>
                        <h3>{d.patient_name}</h3>
                        <small>Approved {formatDate(d.created, true)}</small>
                      </div>
                    </div>
                    <Status value="APPROVED" />
                  </div>
                  <h3>{JSON.parse(d.content).diagnosis}</h3>
                  <p className="preserve">{JSON.parse(d.content).treatment}</p>
                  <Link
                    className="text-link"
                    href={`/patients/${d.patient_id}/encounters/${d.encounter_id}/records`}
                  >
                    View decision and audit trail{" "}
                    <Icon name="arrow" size={16} />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </>
    );
  if (m.route === "/patients")
    return (
      <>
        <PageHeading
          eyebrow="Patient directory"
          title="My Patients"
          description="Find a patient, review their history and open an encounter."
          action={
            <span className="soft-label">
              <Icon name="shield" size={16} />
              Your assigned records only
            </span>
          }
        />
        <div className="panel directory">
          <div className="directory-tools">
            <div className="searchbar">
              <Icon name="search" />
              <input
                aria-label="Search patients"
                placeholder="Search patients by name or reference..."
                value={m.query}
                onChange={(e) => m.setQuery(e.target.value)}
              />
              {m.query && (
                <button
                  className="icon-button"
                  aria-label="Clear patient search"
                  onClick={() => m.setQuery("")}
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
            <span className="muted">
              {filtered.length} of {m.patients.length} patients
            </span>
          </div>
          {!m.patients.length ? (
            <Empty
              icon="patients"
              title="No patients assigned"
              description="No patients assigned. Newly registered physicians start with an empty list. Use a demo physician account to explore existing records."
            />
          ) : !filtered.length ? (
            <Empty
              icon="search"
              title="No matching patients"
              description="Try another name or patient reference."
              action={
                <button onClick={() => m.setQuery("")}>Clear search</button>
              }
            />
          ) : (
            <div className="patient-directory">
              {filtered.map((p: any) => (
                <Link
                  className="patient-directory-row"
                  href={`/patients/${p.id}`}
                  key={p.id}
                >
                  <Avatar name={p.name} />
                  <div className="patient-main">
                    <strong>{p.name}</strong>
                    <small>
                      Patient {String(p.id).padStart(4, "0")} · Synthetic record
                    </small>
                  </div>
                  <p>{p.info.replace("Synthetic record only. ", "")}</p>
                  <span className="encounter-count">
                    {p.encounter_count} encounters
                  </span>
                  <span className="row-open">
                    Open Patient
                    <Icon name="arrow" size={17} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="quiet-note">
          <Icon name="info" size={16} />
          Patient assignments are provided by the local demo dataset. New
          accounts have no assigned records.
        </div>
      </>
    );
  if (m.route !== "/dashboard" && m.route !== "/")
    return (
      <>
        <PageHeading
          title="Page not found"
          description="This page is not part of your physician workspace."
        />
        <Link href="/dashboard" className="btn primary">
          Return to Dashboard
        </Link>
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow="Workspace overview"
        title="Dashboard"
        description={`Welcome back, ${m.user.name}. Pick up an encounter or find a patient.`}
        action={
          <Link href="/patients" className="btn primary">
            <Icon name="patients" size={18} />
            Open My Patients
          </Link>
        }
      />
      <div className="metrics">
        {[
          ["Assigned patients", metrics.patients, "patients", "/patients"],
          ["Stored encounters", metrics.encounters, "records", "/patients"],
          ["Awaiting review", metrics.pending, "review", "/reviews"],
          ["Approved decisions", metrics.approved, "shield", "/records"],
        ].map(([label, value, icon, href]) => (
          <Link href={String(href)} className="metric-card" key={String(label)}>
            <span className="metric-icon">
              <Icon name={String(icon)} />
            </span>
            <span className="metric-label">{label}</span>
            <strong>{value}</strong>
            <Icon name="arrow" size={16} />
          </Link>
        ))}
      </div>
      <div className="dashboard-columns">
        <div className="stack">
          <section className="workspace-banner">
            <span className="eyebrow">
              {m.lastEncounter ? "Continue your work" : "Start an encounter"}
            </span>
            <h2>
              {m.lastEncounter
                ? m.lastEncounter.name
                : "A clear path from consultation to decision"}
            </h2>
            <p>
              {m.lastEncounter
                ? "Return to the last encounter you opened. Saved information is ready to review."
                : "Choose a patient to review history, record a consultation and prepare a draft for your approval."}
            </p>
            <Link
              className="btn primary"
              href={m.lastEncounter?.href || "/patients"}
            >
              {m.lastEncounter ? "Resume encounter" : "Find a patient"}
              <Icon name="arrow" size={17} />
            </Link>
            <span className="banner-mark">
              <Icon name="records" size={85} />
            </span>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Encounter worklist</h2>
                <p>Most recent stored encounter dates</p>
              </div>
              <Link className="text-link" href="/patients">
                View patients <Icon name="arrow" size={15} />
              </Link>
            </div>
            {data?.encounters.length ? (
              <EncounterRows items={data.encounters.slice(0, 4)} />
            ) : (
              <Empty
                icon="patients"
                title="No encounters to display"
                description="No patients assigned. Sign in with a demo physician to explore the workflow."
              />
            )}
          </section>
        </div>
        <aside className="stack">
          <section className="panel">
            <div className="panel-heading">
              <h2>Your workflow</h2>
              <Link
                className="icon-button"
                aria-label="Open workflow guide"
                href="/guide"
              >
                <Icon name="help" size={18} />
              </Link>
            </div>
            <ol className="workflow-guide">
              {[
                [
                  "Review the patient",
                  "Choose the right patient and encounter.",
                ],
                [
                  "Document the consultation",
                  "Record, correct and save your notes.",
                ],
                [
                  "Add clinical inputs",
                  "Save documents, labs and medications.",
                ],
                [
                  "Review and decide",
                  "Inspect the draft, then modify, reject or approve.",
                ],
              ].map(([title, desc], i) => (
                <li key={title}>
                  <span>{i + 1}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Recent activity</h2>
              <Icon name="clock" size={18} />
            </div>
            {!data?.activity.length ? (
              <p className="muted empty-inline">
                No activity yet. Saved actions will appear here.
              </p>
            ) : (
              <div className="activity-list">
                {data.activity.slice(0, 5).map((a: any) => (
                  <Link
                    key={a.id}
                    href={`/patients/${a.patient_id}/encounters/${a.encounter_id}/records`}
                  >
                    <span className="activity-dot" />
                    <div>
                      <strong>{actionLabels[a.action] || a.action}</strong>
                      <p>{a.patient_name}</p>
                      <small>{formatDate(a.created, true)}</small>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
export function PatientDetail({ m }: { m: any }) {
  const p = m.patientData?.patient;
  if (!p || p.id !== m.pid)
    return m.error ? (
      <Empty
        icon="patients"
        title="Patient unavailable"
        description="This record could not be opened. Return to your assigned patient directory."
        action={
          <Link className="btn" href="/patients">
            Open My Patients
          </Link>
        }
      />
    ) : (
      <div className="skeleton-panel" />
    );
  return (
    <>
      <Link href="/patients" className="back-link">
        <Icon name="back" size={16} />
        My Patients
      </Link>
      <PageHeading
        eyebrow="Patient profile"
        title={p.name}
        description={`Patient ${String(p.id).padStart(4, "0")} · Synthetic record`}
      />
      <div className="patient-detail-grid">
        <aside className="panel patient-summary">
          <Avatar name={p.name} />
          <h2>{p.name}</h2>
          <span className="soft-label">Assigned to you</span>
          <h3>Record overview</h3>
          <p>{p.info.replace("Synthetic record only. ", "")}</p>
          <div className="summary-foot">
            <Icon name="shield" size={18} />
            <p>Confirm this patient's identity before opening an encounter.</p>
          </div>
        </aside>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Encounter history</h2>
              <p>Select the visit you want to work on.</p>
            </div>
            <span className="count-tag">{m.patientData.encounters.length}</span>
          </div>
          <div className="timeline">
            {m.patientData.encounters.map((e: any, i: number) => (
              <article key={e.id} className="timeline-item">
                <span className="timeline-dot" />
                <div className="toolbar">
                  <div>
                    <span className="eyebrow">{formatDate(e.date)}</span>
                    <h3>{e.title}</h3>
                    <p className="muted">
                      Encounter {e.id}
                      {i === 0 ? " · Most recent stored visit" : ""}
                    </p>
                  </div>
                  <Link
                    className={"btn " + (i === 0 ? "primary" : "")}
                    href={`/patients/${m.pid}/encounters/${e.id}/consultation`}
                  >
                    Open Encounter <Icon name="arrow" size={16} />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
function Guide() {
  return (
    <>
      <PageHeading
        eyebrow="Help and orientation"
        title="Workspace Guide"
        description="A short guide to completing an encounter in Zeest."
      />
      <div className="guide-grid">
        {[
          [
            "patients",
            "1. Choose the right encounter",
            "Open My Patients, search for a name, then choose the visit from Encounter history. The patient and date stay visible throughout the workflow.",
          ],
          [
            "mic",
            "2. Record and save notes",
            "Start recording and allow microphone access. Stop to finish the transcript, correct the text and save. You can also upload an audio file. Enter structured notes yourself.",
          ],
          [
            "file",
            "3. Add clinical information",
            "Use the Imaging, Laboratory and Medication tabs. Save each input before moving on. Uploaded documents are stored, but are not analysed by a clinical model.",
          ],
          [
            "review",
            "4. Review and decide",
            "Select a demo scenario, generate a draft and read its evidence and critic. Modify saves a pending revision. Reject records no decision. Approve requires confirmation.",
          ],
        ].map(([icon, title, text]) => (
          <section className="panel guide-card" key={title}>
            <span className="metric-icon">
              <Icon name={icon} />
            </span>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </div>
      <Tip title="Understanding this local demo">
        Speech recognition, saved records and review actions are functional.
        Clinical findings, draft recommendations, evidence and critic are fixed
        simulations. No clinical accuracy is claimed.
      </Tip>
      <section className="panel section">
        <h2>If something needs attention</h2>
        <details>
          <summary>Microphone access is blocked</summary>
          <p>
            Allow microphone permission in your browser and check the Windows
            input device. You can use Upload audio instead. Recording requires
            localhost.
          </p>
        </details>
        <details>
          <summary>A transcript is still processing</summary>
          <p>
            Wait for the status to show that the final transcript is ready.
            Notes unlock when processing finishes. A missing model or decoding
            failure appears as an error; the captured file remains playable.
          </p>
        </details>
        <details>
          <summary>A draft is out of date</summary>
          <p>
            Source information changed after this draft was created. Generate a
            fresh draft, then review and confirm the exact saved revision.
          </p>
        </details>
        <details>
          <summary>Where are approved decisions?</summary>
          <p>
            Open Patient Records from the sidebar for all accepted decisions, or
            use the last step within an encounter for its decisions and audit
            trail.
          </p>
        </details>
      </section>
    </>
  );
}
