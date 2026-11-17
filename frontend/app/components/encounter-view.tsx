"use client";
import Link from "next/link";
import { useEffect } from "react";
import {
  Icon,
  Avatar,
  Status,
  PageHeading,
  Empty,
  Tip,
  Sources,
  formatDate,
  actionLabels,
} from "./ui";
export function EncounterView({ m }: { m: any }) {
  const titles: Record<string, string> = {
    consultation: "Consultation",
    inputs: "Clinical Inputs and Findings",
    review: "Clinical Review",
    records: "Patient Records",
  };
  const descriptions: Record<string, string> = {
    consultation:
      "Capture the conversation, review the transcript and save your notes.",
    inputs:
      "Review clinical documents supplied when this consultation was created.",
    review: "Inspect a saved draft and make an explicit review decision.",
    records: "Review accepted decisions and the history of saved actions.",
  };
  if (!m.enc || m.enc.encounter.id !== m.eid) {
    const backendOffline = /backend unavailable|cannot reach backend/i.test(
      m.error || "",
    );
    return m.error ? (
      <Empty
        icon="records"
        title={
          backendOffline
            ? "Backend connection unavailable"
            : "Consultation unavailable"
        }
        description={
          backendOffline
            ? "Your saved consultation remains stored. Start or restart the backend, then reconnect."
            : "This consultation could not be opened. It may have been reassigned or may not belong to this physician."
        }
        action={
          backendOffline ? (
            <button className="btn primary" onClick={() => m.action(m.reload)}>
              Retry connection
            </button>
          ) : (
            <Link className="btn" href="/patients">
              Open My Patients
            </Link>
          )
        }
      />
    ) : (
      <div className="skeleton-panel" />
    );
  }
  const step = ["consultation", "inputs", "review", "records"].indexOf(
    m.screen,
  );
  return (
    <>
      <Link className="back-link" href={`/patients/${m.pid}`}>
        <Icon name="back" size={16} />
        Patient details and consultation history
      </Link>
      <PageHeading
        eyebrow={`Consultation workspace · Step ${step + 1} of 4`}
        title={titles[m.screen] || "Consultation"}
        description={descriptions[m.screen]}
      />
      <section
        className="patient-context"
        aria-label="Selected patient and consultation"
      >
        <div className="identity">
          <Avatar name={m.enc.patient.name} />
          <div>
            <strong>{m.enc.patient.name}</strong>
            <small>
              Patient {String(m.pid).padStart(4, "0")} · Synthetic record
            </small>
          </div>
        </div>
        <div className="context-visit">
          <Icon name="clock" size={18} />
          <div>
            <strong>{formatDate(m.enc.encounter.date)}</strong>
            <small>
              {m.enc.encounter.title} · Consultation {m.eid}
            </small>
          </div>
        </div>
        <Status value={m.enc.encounter.lifecycle || m.draft?.status} />
      </section>
      <nav className="encounter-steps" aria-label="Consultation workflow">
        {[
          ["consultation", "Consultation", "Notes and recording"],
          ["inputs", "Clinical Inputs", "Documents and observations"],
          ["review", "Review", "Draft and physician decision"],
          ["records", "Patient Records", "Decisions and audit trail"],
        ].map(([key, label, desc], i) => (
          <Link
            key={key}
            href={`${m.base}/${key}`}
            aria-label={label}
            className={m.screen === key ? "active" : ""}
            aria-current={m.screen === key ? "step" : undefined}
          >
            <span className="step-number">{i + 1}</span>
            <span>
              <strong>{label}</strong>
              <small>{desc}</small>
            </span>
            <Icon name="arrow" size={15} />
          </Link>
        ))}
      </nav>
      {m.screen === "consultation" ? (
        <Consultation m={m} />
      ) : m.screen === "inputs" ? (
        <Inputs m={m} />
      ) : m.screen === "review" ? (
        <Review m={m} />
      ) : m.screen === "records" ? (
        <Records m={m} />
      ) : (
        <Empty
          title="Page not found"
          description="Choose a step above to continue this consultation."
        />
      )}
    </>
  );
}
function Consultation({ m }: { m: any }) {
  const field = (label: string, key: string, placeholder: string) => (
    <div className="field" key={key}>
      <label htmlFor={key}>{label}</label>
      <textarea
        id={key}
        rows={key === "transcript" ? 11 : 3}
        readOnly={m.recording || m.speechPending > 0}
        placeholder={placeholder}
        value={m.notes[key]}
        onChange={(e) => m.setNotes({ ...m.notes, [key]: e.target.value })}
      />
    </div>
  );
  return (
    <>
      <div className="consultation-grid">
        <aside className="stack">
          <section className="panel recorder">
            <div className="panel-heading">
              <h2>Consultation recording</h2>
              <span
                className={"live-indicator " + (m.recording ? "is-live" : "")}
              >
                {m.recording ? "Live" : "Ready"}
              </span>
            </div>
            <div
              className={"recording-stage " + (m.recording ? "is-live" : "")}
            >
              <div className="microphone-orb">
                <Icon name="mic" size={30} />
              </div>
              <h3>{m.recording ? "Recording" : "Ready when you are"}</h3>
              <p>
                {m.recording
                  ? "Speak naturally. Your transcript updates while recording."
                  : "Record a consultation or upload an audio file."}
              </p>
              <meter
                className="input-meter"
                aria-label="Microphone input level"
                min={0}
                max={1}
                value={m.audioLevel || 0}
              />
            </div>
            <div className="record-controls">
              <button
                className="primary"
                disabled={m.recording || m.busy || m.speechPending > 0}
                onClick={m.start}
              >
                <Icon name="mic" size={17} />
                Start Recording
              </button>
              <button disabled={!m.recording} onClick={() => m.action(m.stop)}>
                <span className="stop-square" />
                Stop Recording
              </button>
            </div>
            <p role="status" className="speech-status">
              {m.speechPending > 0 && <span className="spinner" />}
              {m.speechStatus}
            </p>
            {m.audioUrl && <audio controls src={m.audioUrl} />}
            <div className="upload-audio">
              <h3>Or upload an audio file</h3>
              <label className="file-picker" htmlFor="audio-file">
                <Icon name="upload" size={18} />
                <span>
                  Choose audio file
                  <small>
                    WAV, MP3, M4A and other audio formats | Max 20 MB
                  </small>
                </span>
                <input
                  id="audio-file"
                  aria-label="WAV, MP3, M4A audio upload"
                  type="file"
                  accept="audio/*,.mp4"
                  disabled={m.recording || m.busy || m.speechPending > 0}
                  onChange={(e) => {
                    if (e.target.files?.[0]) m.audioUpload(e.target.files[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </section>
          <Tip title="How to record">
            Allow microphone access, select Start Recording, then Stop Recording
            when finished. Review the final transcript before saving.
            Recognition runs on this computer.
          </Tip>
          {m.jobs.length > 0 && (
            <details className="panel">
              <summary>
                Saved recordings{" "}
                <span className="count-tag">{m.jobs.length}</span>
              </summary>
              <div className="saved-recordings">
                {m.jobs.map((j: any, i: number) => (
                  <article key={j.id}>
                    <div className="toolbar">
                      <strong>Recording {i + 1}</strong>
                      <Status value={j.status} />
                    </div>
                    {j.error && <p className="inline-error">{j.error}</p>}
                    <audio
                      controls
                      preload="none"
                      src={`/api/inputs/${j.input_id}/file`}
                    />
                    <button
                      className="small-button"
                      disabled={
                        !j.transcript || m.recording || m.speechPending > 0
                      }
                      onClick={() => {
                        m.setNotes((n: any) => ({
                          ...n,
                          transcript: j.transcript,
                        }));
                        m.setNoteTab("transcript");
                        m.setMessage(
                          "Saved transcript loaded into the editor. Review and save notes.",
                        );
                      }}
                    >
                      Use saved transcript
                    </button>
                  </article>
                ))}
              </div>
            </details>
          )}
        </aside>
        <section className="panel note-editor">
          <div className="panel-heading">
            <div>
              <h2>Consultation notes</h2>
              <p>Review the recognised text, then document your assessment.</p>
            </div>
            <span className={"save-state " + (m.dirty ? "unsaved" : "")}>
              <Icon name={m.dirty ? "clock" : "check"} size={15} />
              {m.dirty ? "Unsaved changes" : "Saved"}
            </span>
          </div>
          <div className="segmented" role="tablist" aria-label="Note editor">
            <button
              role="tab"
              aria-selected={m.noteTab === "transcript"}
              tabIndex={m.noteTab === "transcript" ? 0 : -1}
              aria-controls="note-transcript"
              id="transcript-tab"
              className={m.noteTab === "transcript" ? "active" : ""}
              onClick={() => m.setNoteTab("transcript")}
            >
              Transcript
            </button>
            <button
              role="tab"
              aria-selected={m.noteTab === "structured"}
              tabIndex={m.noteTab === "structured" ? 0 : -1}
              aria-controls="note-structured"
              id="structured-tab"
              className={m.noteTab === "structured" ? "active" : ""}
              onClick={() => m.setNoteTab("structured")}
            >
              Structured Notes
            </button>
          </div>
          <div
            role="tabpanel"
            id={
              m.noteTab === "transcript" ? "note-transcript" : "note-structured"
            }
            aria-labelledby={
              m.noteTab === "transcript" ? "transcript-tab" : "structured-tab"
            }
          >
            {m.noteTab === "transcript" ? (
              <>
                {field(
                  "Recognised transcript",
                  "transcript",
                  "Your recognised speech will appear here. You can also type consultation notes.",
                )}
                <p className="hint">
                  Correct recognition errors here. Original recognised audio
                  transcripts remain available in Saved recordings.
                </p>
              </>
            ) : (
              <>
                <div className="note-fields">
                  {field(
                    "Subjective",
                    "subjective",
                    "Symptoms, concerns and relevant history",
                  )}
                  {field(
                    "Objective",
                    "objective",
                    "Examination findings and observations",
                  )}
                  {field(
                    "Assessment (physician entered)",
                    "assessment",
                    "Your clinical assessment",
                  )}
                  {field(
                    "Plan (physician entered)",
                    "plan",
                    "Your proposed next steps",
                  )}
                </div>
                <p className="hint">
                  These fields are entered by the physician. Speech recognition
                  does not generate a clinical assessment.
                </p>
              </>
            )}
          </div>
          <div className="editor-footer">
            <span className="muted">
              {m.speechPending > 0
                ? "Notes unlock when transcription finishes."
                : "Saving creates a new note revision."}
            </span>
            <button
              className="primary"
              disabled={m.busy || m.recording || m.speechPending > 0}
              onClick={m.saveNotes}
            >
              <Icon name="save" size={16} />
              Save Notes
            </button>
          </div>
          <details className="revision-details">
            <summary>
              Saved note revisions{" "}
              <span className="count-tag">
                {m.enc.inputs.filter((i: any) => i.kind === "notes").length}
              </span>
            </summary>
            <Sources
              items={m.enc.inputs
                .filter((i: any) => i.kind === "notes")
                .slice()
                .reverse()}
            />
          </details>
        </section>
      </div>
      <div className="workflow-footer">
        <span>
          <Icon name="info" size={17} />
          Save your notes before adding clinical inputs.
        </span>
        <Link className="btn primary" href={`${m.base}/inputs`}>
          Continue to Clinical Inputs
          <Icon name="arrow" size={17} />
        </Link>
      </div>
      <details className="panel section">
        <summary>Complete history from earlier consultations</summary>
        {m.history?.history
          .filter((h: any) => h.encounter_id !== m.eid)
          .map((h: any) => (
            <section
              className="section consultation-history-card"
              key={h.encounter_id}
            >
              <div className="panel-heading">
                <div>
                  <h3>{h.title}</h3>
                  <p>
                    {formatDate(h.date)} · Consultation {h.encounter_id}
                  </p>
                </div>
                <span
                  className={h.progress.decision ? "soft-label" : "count-tag"}
                >
                  {h.progress.decision
                    ? "Approved"
                    : h.drafts.length
                      ? "Reviewed"
                      : "In progress"}
                </span>
              </div>
              <div className="history-progress">
                {[
                  ["Notes", h.progress.notes],
                  ["Clinical inputs", h.progress.clinical_inputs],
                  ["Review", h.progress.review],
                  ["Decision", h.progress.decision],
                ].map(([label, done]: any) => (
                  <span className={done ? "complete" : ""} key={label}>
                    <Icon name={done ? "check" : "clock"} size={14} />
                    {label}
                  </span>
                ))}
              </div>
              <Sources
                items={h.sources.filter((i: any) => i.kind !== "audio")}
              />
              <p className="muted">
                {h.recordings.length} recordings · {h.findings.length} findings
                · {h.drafts.length} draft revisions · {h.audit.length} saved
                actions
              </p>
            </section>
          ))}
      </details>
    </>
  );
}
export function ScenarioSelect({ m }: { m: any }) {
  return (
    <div className="field scenario-field">
      <label htmlFor="scenario">Clinical scenario</label>
      <select
        id="scenario"
        value={m.scenario}
        onChange={(e) => m.setScenario(e.target.value)}
      >
        <option value="respiratory">Synthetic respiratory follow-up</option>
        <option value="routine">Synthetic routine review</option>
      </select>
    </div>
  );
}
function Inputs({ m }: { m: any }) {
  const sources = m.enc.inputs.filter((i: any) => i.kind === m.tab);
  return (
    <>
      <div className="clinical-input-layout">
        <section className="panel">
          <div
            className="tabs"
            role="tablist"
            aria-label="Clinical input types"
          >
            {[
              ["imaging", "Chest X-ray", "upload"],
              ["clinical_report", "Clinical Reports", "file"],
              ["laboratory", "Laboratory", "file"],
              ["medication", "Medication", "shield"],
              ["document", "Documents", "records"],
              ["findings", "Findings", "review"],
            ].map(([key, label, icon]) => (
              <button
                role="tab"
                key={key}
                aria-selected={m.tab === key}
                tabIndex={m.tab === key ? 0 : -1}
                aria-controls="clinical-input-panel"
                id={`input-tab-${key}`}
                className={m.tab === key ? "active" : ""}
                onClick={() => m.setTab(key)}
              >
                <Icon name={icon} size={17} />
                {label}
              </button>
            ))}
          </div>
          <div
            id="clinical-input-panel"
            role="tabpanel"
            aria-labelledby={`input-tab-${m.tab}`}
          >
            {m.tab === "imaging" ? (
              <>
                <h2>Chest X-ray</h2>
                <p className="sub">
                  Chest X-rays are a separate Imaging Agent input. Report NLP does not interpret images.
                </p>
                <Tip title="Chest X-ray specialist input">
                  The upload is stored under Chest X-ray for the separate Imaging Agent. Image findings are not generated in this interface yet.
                </Tip>
              </>
            ) : m.tab === "findings" ? (
              <>
                <div className="panel-heading">
                  <div>
                    <h2>Simulated findings</h2>
                    <p>
                      Fixed outputs for an explicitly selected clinical scenario.
                    </p>
                  </div>
                  <span className="soft-label">Simulation</span>
                </div>
                <div className="fixture-controls">
                  <ScenarioSelect m={m} />
                  <button
                    className="primary"
                    disabled={m.busy}
                    onClick={m.loadFindings}
                  >
                    Load Simulated Findings
                  </button>
                </div>
                {m.findings.length ? (
                  <div className="findings-list">
                    {m.findings.map((f: any, i: number) => (
                      <article key={`${f.input_id}-${i}`}>
                        <div className="source-heading">
                          <Icon name="file" size={18} />
                          <strong>{f.kind}</strong>
                          <small>Source {f.input_id}</small>
                        </div>
                        <p>{f.finding}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon="review"
                    title="No findings loaded"
                    description="Choose a clinical scenario above to inspect its fixed findings. New uploads remain unmapped."
                  />
                )}
              </>
            ) : m.tab === "document" || m.tab === "clinical_report" ? (
              <div>
                <h2>{m.tab === "clinical_report" ? "Clinical reports" : "Other documents"}</h2>
                <p className="sub">
                  {m.tab === "clinical_report"
                    ? "Report NLP extraction is saved under Patient Records > Report NLP."
                    : "Review supporting documents supplied by the administrator."}
                </p>
                <Tip title={m.tab === "clinical_report" ? "Report NLP extraction" : "Administrator-provided documents"}>
                  {m.tab === "clinical_report"
                    ? "Open the saved report or review its extracted mentions under Patient Records."
                    : "Open the saved files below to view them. File attachments are managed by the administrator."}
                </Tip>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  m.saveInput(m.tab);
                }}
              >
                <h2>
                  {m.tab === "laboratory"
                    ? "Laboratory information"
                    : "Medication context"}
                </h2>
                <p className="sub">
                  {m.tab === "laboratory"
                    ? "Administrator information is prefilled below. Review and edit it when required."
                    : "Administrator information is prefilled below. Review and edit it when required."}
                </p>
                <div className="field">
                  <label htmlFor="clinical-content">
                    {m.tab === "laboratory"
                      ? "Values, units and source"
                      : "Medication, dose, frequency and source"}
                  </label>
                  <textarea
                    id="clinical-content"
                    rows={7}
                    minLength={3}
                    maxLength={20000}
                    required
                    placeholder={
                      m.tab === "laboratory"
                        ? "Test name, value, unit, date and source."
                        : "Medication name, dose, frequency and source."
                    }
                    value={m.inputValues[m.tab] || ""}
                    onChange={(e) =>
                      m.setInputValues({
                        ...m.inputValues,
                        [m.tab]: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="editor-footer">
                  <span className="muted">
                    Saving creates a new revision and keeps earlier information.
                  </span>
                  <button className="primary" disabled={m.busy}>
                    <Icon name="save" size={16} />
                    Save Input
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
        <aside className="stack">
          <section className="panel">
            <div className="panel-heading">
              <h2>Consultation sources</h2>
              <span className="count-tag">
                {m.enc.inputs.filter((i: any) => i.kind !== "audio").length}
              </span>
            </div>
            <div className="input-checklist">
              {[
                ["notes", "Consultation notes"],
                ["imaging", "Chest X-ray image"],
                ["clinical_report", "Clinical reports"],
                ["laboratory", "Laboratory"],
                ["medication", "Medication"],
                ["document", "Other documents"],
              ].map(([key, label]) => {
                const count = m.enc.inputs.filter(
                  (i: any) => i.kind === key,
                ).length;
                return (
                  <div key={key}>
                    <span
                      className={count ? "check-circle" : "check-circle blank"}
                    >
                      <Icon name="check" size={13} />
                    </span>
                    <span>{label}</span>
                    <small>{count ? `${count} saved` : "Not supplied"}</small>
                  </div>
                );
              })}
            </div>
          </section>
          <Tip title="What happens next?">
            Save the information you have, then continue to Review. The draft
            uses a saved source snapshot. Clinical outputs are simulated
            fixtures, not an interpretation of new files.
          </Tip>
        </aside>
      </div>
      {m.tab !== "findings" && (
        <section className="panel section">
          <div className="panel-heading">
            <h2>
              Saved{" "}
              {m.tab === "imaging"
                ? "imaging"
                : m.tab === "laboratory"
                  ? "laboratory sources"
                  : m.tab === "medication"
                    ? "medication sources"
                    : "documents"}
            </h2>
            <span className="count-tag">{sources.length}</span>
          </div>
          {sources.length ? (
            <Sources items={sources.slice().reverse()} />
          ) : (
            <Empty
              icon="file"
              title="Nothing saved in this category"
              description="No source was supplied in this category when the consultation was created."
            />
          )}
        </section>
      )}
      <div className="workflow-footer">
        <Link className="text-link" href={`${m.base}/consultation`}>
          <Icon name="back" size={16} />
          Back to Consultation
        </Link>
        <Link className="btn primary" href={`${m.base}/review`}>
          Continue to Review
          <Icon name="arrow" size={17} />
        </Link>
      </div>
    </>
  );
}
function Review({ m }: { m: any }) {
  const d = m.draft,
    stale =
      d &&
      d.status === "PENDING" &&
      JSON.parse(d.snapshot).source_version !== m.enc.encounter.version;
  return (
    <>
      <section className="panel draft-preparation">
        <div>
          <span className="eyebrow">Draft preparation</span>
          <h2>
            {d ? "Prepare another revision" : "Create a draft for your review"}
          </h2>
          <p className="sub">
            Uses the selected simulation plus this patient&apos;s saved
            physician assessment and plan.
          </p>
        </div>
        <ScenarioSelect m={m} />
        <button
          className="primary"
          disabled={m.busy || m.dirty}
          onClick={m.generateDraft}
        >
          <Icon name="review" size={17} />
          Generate Simulated Draft
        </button>
      </section>
      {stale && (
        <Tip title="This draft uses earlier source information">
          Inputs changed after this draft was prepared. Generate a fresh draft
          before modifying, approving or rejecting it.
        </Tip>
      )}
      <div className="review-layout">
        <section className="panel draft-panel">
          {!d ? (
            <Empty
              icon="review"
              title="No draft prepared yet"
              description="Use the controls above to generate a draft. It will remain pending until you explicitly approve or reject it."
            />
          ) : (
            <>
              <div className="panel-heading">
                <div>
                  <h2>Clinical draft</h2>
                  <p>
                    Revision {d.id} · {formatDate(d.created, true)}
                  </p>
                </div>
                <Status value={d.status} />
              </div>
              <div className="simulation-note">
                <Icon name="info" size={17} />
                Simulated clinical content ·{" "}
                {d.scenario === "routine"
                  ? "Routine review"
                  : "Respiratory follow-up"}
              </div>
              <div className="draft-section">
                <span className="section-index">01</span>
                <div>
                  <h3>Draft diagnosis</h3>
                  {m.editing ? (
                    <>
                      <label className="sr-only" htmlFor="diagnosis">
                        Edit diagnosis
                      </label>
                      <textarea
                        id="diagnosis"
                        rows={5}
                        value={m.diagnosis}
                        onChange={(e) => m.setDiagnosis(e.target.value)}
                      />
                    </>
                  ) : (
                    <p className="clinical">{d.diagnosis}</p>
                  )}
                </div>
              </div>
              <div className="draft-section">
                <span className="section-index">02</span>
                <div>
                  <h3>Draft treatment plan</h3>
                  {m.editing ? (
                    <>
                      <label className="sr-only" htmlFor="treatment">
                        Edit treatment plan
                      </label>
                      <textarea
                        id="treatment"
                        rows={6}
                        value={m.treatment}
                        onChange={(e) => m.setTreatment(e.target.value)}
                      />
                    </>
                  ) : (
                    <p className="clinical">{d.treatment}</p>
                  )}
                </div>
              </div>
              {d.status === "PENDING" ? (
                <div className="review-actions">
                  {m.editing ? (
                    <>
                      <p className="hint">
                        Saving creates a new pending revision. It does not
                        approve the draft.
                      </p>
                      <div className="actions right">
                        <button
                          disabled={m.busy}
                          onClick={() => {
                            m.setEditing(false);
                            m.setDiagnosis(d.diagnosis);
                            m.setTreatment(d.treatment);
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          className="primary"
                          disabled={
                            m.busy || !m.diagnosis.trim() || !m.treatment.trim()
                          }
                          onClick={m.saveDraft}
                        >
                          Save Changes
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="hint">
                        Read the draft, evidence and critic before deciding.
                      </p>
                      <div className="actions right">
                        <button
                          disabled={m.busy || stale}
                          onClick={() => m.setEditing(true)}
                        >
                          Modify
                        </button>
                        <button
                          className="danger"
                          disabled={m.busy || stale}
                          onClick={() => {
                            m.setReason("");
                            m.setConfirm("REJECT");
                          }}
                        >
                          Reject
                        </button>
                        <button
                          className="primary"
                          disabled={m.busy || stale}
                          onClick={() => m.setConfirm("APPROVE")}
                        >
                          <Icon name="check" size={16} />
                          Approve
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="decision-outcome">
                  <Icon
                    name={d.status === "APPROVED" ? "shield" : "info"}
                    size={20}
                  />
                  <div>
                    <strong>
                      {d.status === "APPROVED"
                        ? "This revision is an accepted decision"
                        : "This draft was rejected"}
                    </strong>
                    <p>
                      {d.status === "APPROVED"
                        ? "The exact saved content is recorded with your approval."
                        : "No accepted decision was created. Prepare a new draft to continue."}
                    </p>
                    <Link className="text-link" href={`${m.base}/records`}>
                      View Patient Records <Icon name="arrow" size={15} />
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
        <aside className="stack">
          <section className="panel evidence-panel">
            <div className="tabs" role="tablist" aria-label="Draft support">
              {[
                ["evidence", "Evidence"],
                ["critic", "Critic Findings"],
              ].map(([key, label]) => (
                <button
                  role="tab"
                  key={key}
                  id={`support-${key}`}
                  aria-selected={m.evidenceTab === key}
                  tabIndex={m.evidenceTab === key ? 0 : -1}
                  aria-controls="support-panel"
                  className={m.evidenceTab === key ? "active" : ""}
                  onClick={() => m.setEvidenceTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              id="support-panel"
              role="tabpanel"
              aria-labelledby={`support-${m.evidenceTab}`}
            >
              {!d ? (
                <Empty
                  icon="file"
                  title="Supporting material"
                  description="Evidence and critic findings will appear with a generated draft."
                />
              ) : m.evidenceTab === "evidence" ? (
                <>
                  {JSON.parse(d.evidence).map((e: any) => (
                    <article className="evidence-card" key={e.id}>
                      <span className="eyebrow">Illustrative evidence</span>
                      <h3>{e.title}</h3>
                      <p>{e.passage}</p>
                      <small>{e.id} · Fictional source</small>
                    </article>
                  ))}
                </>
              ) : (
                <>
                  <span className="eyebrow">Simulated review</span>
                  <h2>Simulated critic findings</h2>
                  <p>{d.critic}</p>
                </>
              )}
            </div>
          </section>
          <Tip title="Your approval is the decision boundary">
            Modify saves another pending revision. Reject records the review
            action only. Approve opens a confirmation for this exact saved
            revision.
          </Tip>
        </aside>
      </div>
      {d && (
        <details className="panel section">
          <summary>Sources used for this draft</summary>
          <p className="hint">
            These are the saved revisions captured when this draft was prepared.
          </p>
          <Sources
            items={JSON.parse(d.snapshot).input_revisions.filter(
              (i: any) => i.kind !== "audio",
            )}
          />
        </details>
      )}
      <details className="panel section">
        <summary>
          Draft revision history{" "}
          <span className="count-tag">{m.enc.drafts.length}</span>
        </summary>
        {m.enc.drafts.map((r: any) => (
          <article className="source-item" key={r.id}>
            <div className="toolbar">
              <strong>
                Revision {r.id}
                {r.id === d?.id
                  ? " · Current"
                  : r.status === "PENDING"
                    ? " · Superseded"
                    : ""}
              </strong>
              <Status value={r.status} />
            </div>
            <p className="clinical">{r.diagnosis}</p>
            <p className="clinical">{r.treatment}</p>
            <small>{formatDate(r.created, true)}</small>
          </article>
        ))}
      </details>
      <div className="workflow-footer">
        <Link className="text-link" href={`${m.base}/inputs`}>
          <Icon name="back" size={16} />
          Back to Clinical Inputs
        </Link>
        <Link className="btn" href={`${m.base}/records`}>
          Open Patient Records
          <Icon name="arrow" size={16} />
        </Link>
      </div>
      <dialog
        ref={m.dialog}
        className="modal"
        aria-labelledby="confirm-title"
        onCancel={() => m.setConfirm("")}
      >
        <div
          className={
            "dialog-symbol " + (m.confirm === "REJECT" ? "reject" : "")
          }
        >
          <Icon name={m.confirm === "APPROVE" ? "shield" : "close"} size={25} />
        </div>
        <h2 id="confirm-title">
          {m.confirm === "APPROVE" ? "Approve" : "Reject"} clinical draft?
        </h2>
        <p className="sub">
          {m.enc.patient.name} · Revision {d?.id}
        </p>
        <div className="confirmation-preview">
          <strong>Draft diagnosis</strong>
          <p>{d?.diagnosis}</p>
          <strong>Draft treatment plan</strong>
          <p>{d?.treatment}</p>
        </div>
        <p>
          {m.confirm === "APPROVE"
            ? "This records the exact saved revision as an accepted decision."
            : "This records a rejection. No accepted decision will be created."}
        </p>
        {m.confirm === "REJECT" && (
          <div className="field">
            <label htmlFor="reason">Reason (optional)</label>
            <textarea
              id="reason"
              rows={2}
              value={m.reason}
              onChange={(e) => m.setReason(e.target.value)}
              maxLength={2000}
            />
          </div>
        )}
        <div className="actions right">
          <button autoFocus onClick={() => m.setConfirm("")}>
            Cancel
          </button>
          <button
            className={m.confirm === "APPROVE" ? "primary" : "danger"}
            onClick={m.doReview}
          >
            Confirm {m.confirm === "APPROVE" ? "Approval" : "Rejection"}
          </button>
        </div>
      </dialog>
    </>
  );
}
function ReportNLPRecords({ m }: { m: any }) {
  const reports = m.enc.inputs
    .filter((input: any) => input.kind === "clinical_report")
    .slice()
    .reverse();
  return (
    <>
      <div className="panel-heading">
        <div>
          <h2>Structured report extraction</h2>
          <p>Local source-linked mention extraction saved when the administrator uploaded each report.</p>
        </div>
        <span className="soft-label">Research only</span>
      </div>
      <p className="research-notice">
        This output extracts terms mentioned in report text. It is not a diagnosis or a clinical prediction. Use synthetic reports only.
      </p>
      {!reports.length ? (
        <Empty icon="file" title="No clinical reports uploaded" description="An administrator can add a text report or selectable-text PDF during consultation setup. Its structured extraction will appear here." />
      ) : (
        <div className="findings-list">
          {reports.map((input: any) => {
            let saved: any = null;
            try { saved = JSON.parse(input.content); } catch { saved = null; }
            const result = saved?.result;
            const findings = result?.findings || [];
            return (
              <article key={input.id}>
                <div className="source-heading">
                  <Icon name="file" size={18} />
                  <strong>{input.filename || "Clinical report"}</strong>
                  <small>Source {input.id} | {formatDate(input.created, true)}</small>
                </div>
                {input.filename && <p><a className="text-link" href={`/api/inputs/${input.id}/file`}>Open uploaded report</a></p>}
                {saved?.source_text && <details className="research-limits"><summary>Extracted report text</summary><p className="preserve">{saved.source_text}</p></details>}
                {saved?.status === "needs_ocr" ? (
                  <p>{saved.message}</p>
                ) : result ? (
                  <>
                    <p><strong>Method:</strong> {result.method}</p>
                    <p><strong>Result:</strong> {result.status} | {result.support_status}</p>
                    {findings.length ? findings.map((finding: any) => (
                      <section className="report-finding" key={finding.code}>
                        <div className="source-heading"><strong>{finding.label}</strong><small>{finding.assertion} | {finding.value?.concept_type}</small></div>
                        {finding.value?.mentions?.length ? finding.value.mentions.map((mention: any, index: number) => (
                          <p className="preserve research-evidence" key={`${finding.code}-${index}`}>
                            <strong>Source text:</strong> "{mention.text}"{mention.page ? ` | Page ${mention.page}` : ""}<br />
                            <strong>Context:</strong> {mention.assertion}, {mention.temporality}, {String(mention.experiencer).replaceAll("_", " ")} | {mention.method}{mention.extractor_score != null ? ` | model score ${Number(mention.extractor_score).toFixed(3)}` : ""}
                          </p>
                        )) : <p>{finding.explanation}</p>}
                      </section>
                    )) : <p>No supported mentions were extracted. This does not establish that a condition is absent.</p>}
                    {result.limitations?.length > 0 && <details className="research-limits"><summary>Model limitations</summary><ul>{result.limitations.map((item: string) => <li key={item}>{item}</li>)}</ul></details>}
                  </>
                ) : <p>Structured Report NLP output is unavailable for this file.</p>}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function Records({ m }: { m: any }) {
  const hasReports = m.enc.inputs.some((input: any) => input.kind === "clinical_report");
  useEffect(() => {
    if (hasReports && m.recordTab === "decisions") m.setRecordTab("reports");
    if (!hasReports && m.recordTab === "reports") m.setRecordTab("decisions");
  }, [m.eid, hasReports]);
  return (
    <>
      <section className="panel">
        <div className="tabs" role="tablist" aria-label="Consultation records">
          {[
            ["decisions", "Approved Decisions", "shield"],
            ["reports", "Report NLP", "file"],
            ["audit", "Audit History", "clock"],
          ].map(([key, label, icon]) => (
            <button
              key={key}
              role="tab"
              id={`record-${key}`}
              aria-selected={m.recordTab === key}
              tabIndex={m.recordTab === key ? 0 : -1}
              aria-controls="record-panel"
              className={m.recordTab === key ? "active" : ""}
              onClick={() => m.setRecordTab(key)}
            >
              <Icon name={icon} size={17} />
              {label}
              <span className="count-tag">
                {key === "decisions"
                  ? m.records?.decisions.length
                  : key === "reports"
                    ? m.enc.inputs.filter((input: any) => input.kind === "clinical_report").length
                    : m.records?.audit.length}
              </span>
            </button>
          ))}
        </div>
        <div
          id="record-panel"
          role="tabpanel"
          aria-labelledby={`record-${m.recordTab}`}
        >
          {m.recordTab === "decisions" ? (
            <>
              <div className="panel-heading">
                <div>
                  <h2>Approved decisions</h2>
                  <p>Only explicitly approved revisions appear here.</p>
                </div>
              </div>
              {!m.records?.decisions.length ? (
                <Empty
                  icon="shield"
                  title="No approved decisions"
                  description="Pending and rejected drafts are excluded. Review a saved draft and confirm approval to record a decision."
                  action={
                    <Link className="btn" href={`${m.base}/review`}>
                      Return to Review
                      <Icon name="arrow" size={16} />
                    </Link>
                  }
                />
              ) : (
                m.records.decisions.map((d: any) => (
                  <article className="decision-card" key={d.id}>
                    <div className="toolbar">
                      <span className="eyebrow">
                        Revision {d.draft_id} · {formatDate(d.created, true)}
                      </span>
                      <Status value="APPROVED" />
                    </div>
                    <p className="simulation-note">
                      Simulated clinical content · physician approved
                    </p>
                    <h3>{JSON.parse(d.content).diagnosis}</h3>
                    <p className="clinical">
                      {JSON.parse(d.content).treatment}
                    </p>
                  </article>
                ))
              )}
            </>
          ) : m.recordTab === "reports" ? (
            <ReportNLPRecords m={m} />
          ) : (
            <>
              <div className="panel-heading">
                <div>
                  <h2>Append-only audit history</h2>
                  <p>
                    Saved actions are retained and cannot be edited in the
                    application.
                  </p>
                </div>
                <span className="soft-label">
                  <Icon name="shield" size={15} />
                  Read only
                </span>
              </div>
              {!m.records?.audit.length ? (
                <Empty
                  icon="clock"
                  title="No audit events yet"
                  description="Saving notes, adding inputs and reviewing drafts will create events here."
                />
              ) : (
                <div className="audit-timeline">
                  {m.records.audit.map((a: any) => (
                    <article className="audit-event" key={a.id}>
                      <span className="audit-event-icon">
                        <Icon
                          name={
                            a.action === "APPROVE"
                              ? "shield"
                              : a.action === "TRANSCRIBE"
                                ? "mic"
                                : "file"
                          }
                          size={17}
                        />
                      </span>
                      <div>
                        <strong>{actionLabels[a.action] || a.action}</strong>
                        <p>
                          {a.physician}
                          {a.revision_id ? ` · Revision ${a.revision_id}` : ""}
                        </p>
                        {a.detail && <small>{a.detail}</small>}
                      </div>
                      <time dateTime={a.created}>
                        {formatDate(a.created, true)}
                      </time>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
      <div className="workflow-footer">
        <Link className="text-link" href={`${m.base}/review`}>
          <Icon name="back" size={16} />
          Back to Review
        </Link>
        <Link className="btn" href={`/patients/${m.pid}`}>
          Return to Patient
          <Icon name="arrow" size={16} />
        </Link>
      </div>
    </>
  );
}
