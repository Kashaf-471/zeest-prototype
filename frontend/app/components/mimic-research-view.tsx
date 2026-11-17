"use client";

import { useState } from "react";
import { PageHeading } from "./ui";

type Mention = {
  text?: string;
  sentence?: string;
  assertion?: string;
  temporality?: string;
  experiencer?: string;
  method?: string;
};
type Finding = {
  code: string;
  label: string;
  assertion: string;
  concept_type?: string;
  explanation?: string;
  mentions: Mention[];
};
type RecordRow = {
  note_id: string;
  subject_id: string;
  hadm_id?: string | null;
  note_type?: string | null;
  charttime?: string | null;
  method?: string;
  status?: string;
  limitations: string[];
  findings: Finding[];
};
type Payload = {
  dataset: string;
  table: string;
  records: RecordRow[];
  count: number;
  research_only: boolean;
  demo_patient_records_unchanged: boolean;
};

export function MimicResearchView({ m }: { m: any }) {
  const [table, setTable] = useState("radiology");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadResults() {
    setBusy(true);
    setError("");
    setPayload(null);
    try {
      const value = await m.api(
        `/research/mimic-note/results?table=${table}&limit=25`,
      );
      setPayload(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Local research workspace"
        title="MIMIC-IV-Note structuring demo"
        description="Inspect locally generated Report NLP findings without importing MIMIC records into demo patients."
      />
      <div className="research-notice" role="note">
        <strong>Credentialed dataset, local research use only</strong>
        <p>
          Use this screen only on a private machine where the logged-in person
          has individual PhysioNet authorization and has signed the dataset
          agreement. The backend reads a local JSONL result file. Nothing here
          is saved to demo patient records. Do not share this screen, source
          snippets, screenshots, or extracted results.
        </p>
      </div>

      <section className="panel section">
        <div className="panel-heading">
          <div>
            <h2>Load a local sample</h2>
            <p>
              First run the local structuring command in Fyp-Zeest. This screen
              reads up to 25 saved records from its output.
            </p>
          </div>
          <span className="soft-label">No demo patient linkage</span>
        </div>
        <div className="mimic-controls">
          <div className="field">
            <label htmlFor="mimic-table">MIMIC-IV-Note table</label>
            <select
              id="mimic-table"
              value={table}
              onChange={(event) => setTable(event.target.value)}
            >
              <option value="radiology">Radiology reports</option>
              <option value="discharge">Discharge summaries</option>
            </select>
          </div>
          <button className="primary" onClick={loadResults} disabled={busy}>
            {busy ? "Loading local results..." : "Load structured results"}
          </button>
        </div>
        {error && (
          <div role="alert" className="research-error">
            {error}
          </div>
        )}
      </section>

      {payload && (
        <section className="panel section" aria-live="polite">
          <div className="panel-heading">
            <div>
              <h2>
                {payload.table === "radiology"
                  ? "Radiology report results"
                  : "Discharge summary results"}
              </h2>
              <p>
                {payload.count} local records | {payload.dataset} | first 25
                saved results
              </p>
            </div>
            <span className="soft-label">Exploratory extraction</span>
          </div>
          {payload.records.length ? (
            <div className="mimic-record-list">
              {payload.records.map((record) => (
                <article className="mimic-record" key={record.note_id}>
                  <details>
                    <summary>
                      <span>
                        <strong>Report {record.note_id}</strong>
                        <small>
                          Subject {record.subject_id}
                          {record.charttime ? ` | ${record.charttime}` : ""}
                        </small>
                      </span>
                      <span className="soft-label">
                        {record.findings.length} extracted groups
                      </span>
                    </summary>
                    <p className="mimic-method">
                      Method: {record.method || "Not recorded"} | Status: {record.status || "unknown"}
                    </p>
                    {record.findings.length ? (
                      <div className="findings-list">
                        {record.findings.map((finding) => (
                          <article key={finding.code}>
                            <div className="source-heading">
                              <strong>{finding.label}</strong>
                              <small>
                                {finding.assertion} | {finding.concept_type || "mention"}
                              </small>
                            </div>
                            {finding.mentions.map((mention, index) => (
                              <div
                                className="research-evidence preserve"
                                key={`${finding.code}-${index}`}
                              >
                                <p>
                                  <strong>Source:</strong> “{mention.text}”
                                </p>
                                {mention.sentence && (
                                  <p>{mention.sentence}</p>
                                )}
                                <small>
                                  {mention.assertion || finding.assertion}
                                  {mention.temporality
                                    ? ` | ${mention.temporality}`
                                    : ""}
                                  {mention.experiencer
                                    ? ` | ${mention.experiencer.replaceAll("_", " ")}`
                                    : ""}
                                </small>
                              </div>
                            ))}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p>No supported mentions were extracted from this report.</p>
                    )}
                    {record.limitations.length > 0 && (
                      <details className="research-limits">
                        <summary>Extraction limitations</summary>
                        <ul>
                          {record.limitations.map((limitation) => (
                            <li key={limitation}>{limitation}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <p>No structured records are available in this local result file.</p>
          )}
          <p className="sub">
            These are model and rule extracted mentions, not confirmed diagnoses
            or an accuracy result. Review against the source report. This screen
            does not connect results to prototype patients.
          </p>
        </section>
      )}
    </>
  );
}
