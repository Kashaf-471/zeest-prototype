"use client";
import { useEffect, useMemo, useState } from "react";
import { PageHeading } from "./ui";

type Encounter = { id: number; date: string; title: string };
type Patient = { id: number; name: string };

export function PatientMemoryView({ m }: { m: any }) {
  const patients: Patient[] = m.patients || [];
  const [patientId, setPatientId] = useState("");
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [encounterId, setEncounterId] = useState("");
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [retrievalMode, setRetrievalMode] = useState("semantic");
  const [result, setResult] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [experiment, setExperiment] = useState<any>(null);
  const [experimentError, setExperimentError] = useState("");

  useEffect(() => {
    let live = true;
    m.api("/research/patient-memory/results")
      .then((value: any) => live && setExperiment(value))
      .catch((reason: Error) => live && setExperimentError(reason.message));
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!patients.length) return;
    if (!patientId || !patients.some((patient) => String(patient.id) === patientId)) {
      setPatientId(String(patients[0].id));
    }
  }, [patients, patientId]);

  useEffect(() => {
    if (!patientId) return;
    let live = true;
    setLoadingHistory(true);
    setError("");
    setResult(null);
    setEncounterId("");
    m.api(`/patients/${patientId}`)
      .then((data: any) => {
        if (!live) return;
        const sorted = [...data.encounters].sort((a: Encounter, b: Encounter) =>
          b.date.localeCompare(a.date) || b.id - a.id,
        );
        setEncounters(sorted);
        setEncounterId(sorted[0] ? String(sorted[0].id) : "");
      })
      .catch((reason: Error) => live && setError(reason.message))
      .finally(() => live && setLoadingHistory(false));
    return () => { live = false; };
  }, [patientId]);

  const selectedEncounter = useMemo(
    () => encounters.find((encounter) => String(encounter.id) === encounterId),
    [encounters, encounterId],
  );

  async function retrieve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!patientId || !encounterId || query.trim().length < 2) return;
    setSearching(true);
    setError("");
    setResult(null);
    try {
      const value = await m.api(`/patients/${patientId}/memory`, {
        method: "POST",
        body: JSON.stringify({ encounter_id: Number(encounterId), query: query.trim(), top_k: topK, mode: retrievalMode }),
      });
      setResult(value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Memory retrieval failed.");
    } finally {
      setSearching(false);
    }
  }

  const findings = result?.result?.findings || [];
  const patientName = patients.find((patient) => String(patient.id) === patientId)?.name;

  return (
    <>
      <PageHeading
        eyebrow="Patient history"
        title="Patient Memory"
        description="Find relevant information in this patient’s earlier saved visits and inspect the source for every match."
      />
      <div className="research-notice">
        <strong>History retrieval, not diagnosis</strong>
        <p>Semantic mode uses the MedEmbed-small model locally to rank related wording. Keyword mode is the exact-word comparison baseline. Similarity scores are retrieval rankings, not probabilities. Only this physician?s records for this patient, before the selected visit, can appear.</p>
      </div>
      <section className="panel section">
        <div className="panel-heading">
          <div><h2>Search earlier records</h2><p>Choose a visit as the cutoff, then describe what you want to find.</p></div>
          <span className="soft-label">Local model + keyword baseline</span>
        </div>
        {!patients.length ? (
          <p>No patients are assigned to this physician account yet.</p>
        ) : (
          <form onSubmit={retrieve}>
            <div className="research-metrics">
              <div className="field">
                <label htmlFor="memory-patient">Patient</label>
                <select id="memory-patient" value={patientId} onChange={(event) => setPatientId(event.target.value)}>
                  {patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="memory-cutoff">Search records before</label>
                <select id="memory-cutoff" value={encounterId} onChange={(event) => { setEncounterId(event.target.value); setResult(null); }} disabled={loadingHistory || !encounters.length}>
                  {encounters.map((encounter) => <option key={encounter.id} value={encounter.id}>{encounter.date} · {encounter.title}</option>)}
                </select>
              </div>
            </div>
            {loadingHistory ? <p role="status">Loading visit history…</p> : !encounters.length ? <p>This patient has no saved visits to use as a cutoff.</p> : null}
            <div className="field">
              <label htmlFor="memory-query">Search question or keywords</label>
              <textarea id="memory-query" rows={3} maxLength={500} minLength={2} required value={query} onChange={(event) => setQuery(event.target.value)} placeholder="For example: asthma, wheezing, and prior inhaler use" />
              <small>Use meaningful words from the history. The current visit is excluded from search results.</small>
            </div>
            <div className="field">
              <label htmlFor="memory-mode">Retrieval method</label>
              <select id="memory-mode" value={retrievalMode} onChange={(event) => { setRetrievalMode(event.target.value); setResult(null); }}>
                <option value="semantic">Semantic search ? MedEmbed-small</option>
                <option value="keyword">Exact keyword baseline</option>
              </select>
              <small>Semantic mode runs locally. Each search response also includes keyword-baseline results for comparison.</small>
            </div>
            <div className="field">
              <label htmlFor="memory-count">Maximum results</label>
              <select id="memory-count" value={topK} onChange={(event) => setTopK(Number(event.target.value))}>
                {[3, 5, 10].map((count) => <option key={count} value={count}>{count} records</option>)}
              </select>
            </div>
            <button className="primary" disabled={searching || loadingHistory || !encounterId || query.trim().length < 2}>
              {searching ? "Searching earlier records…" : "Retrieve patient history"}
            </button>
          </form>
        )}
        {error && <p role="alert" className="research-error">{error}</p>}
      </section>

      {result && (
        <section className="panel section" aria-live="polite">
          <div className="panel-heading">
            <div><h2>Retrieved history</h2><p>{patientName} · Before {result.as_of_encounter.date}, {result.as_of_encounter.title} · {result.indexed_sources} earlier text sources searched</p></div>
            <span className="soft-label">{result.result.status === "completed" ? `${findings.length} matches` : "No matching text"}</span>
          </div>
          {findings.length ? (
            <div className="findings-list">
              {findings.map((finding: any, index: number) => {
                const source = String(finding.explanation || "").replace(/^Source:\s*/, "");
                const match = source.match(/(?:input:\/\/|\/api\/inputs\/)(\d+)/);
                const inputId = match?.[1];
                const sourceHref = source.startsWith("/api/") ? source : null;
                return (
                  <article key={`${finding.value.encounter_id}-${index}`}>
                    <div className="source-heading">
                      <strong>Earlier visit · {String(finding.value.date).slice(0, 10)}</strong>
                      <small>Lexical similarity {Number(finding.value.retrieval_score).toFixed(3)} · ranking score only</small>
                    </div>
                    <p className="preserve research-evidence">{finding.value.snippet}</p>
                    <p className="sub">Source: {sourceHref ? <a href={sourceHref} target="_blank" rel="noreferrer">{inputId ? `Open saved source ${inputId}` : "Open saved file"}</a> : inputId ? `Saved record ${inputId}` : source || "Earlier saved record"}</p>
                  </article>
                );
              })}
            </div>
          ) : <p>No earlier saved text matched these words. That does not mean the patient has no related history.</p>}
          {result.retrieval_mode === "semantic" && (
            <details className="research-limits">
              <summary>Compare with exact keyword search ({result.keyword_baseline?.length || 0} results)</summary>
              {result.keyword_baseline?.length ? (
                <ul>{result.keyword_baseline.map((item: any) => <li key={item.source_uri}>{String(item.encounter_date).slice(0, 10)} ? {item.snippet}</li>)}</ul>
              ) : <p>Keyword search found no earlier record containing the same query words.</p>}
            </details>
          )}
          <details className="research-limits">
            <summary>Method and limitations</summary>
            <p>Method: {result.result.method}</p>
            {result.model && <p>Model: {result.model.name} ? revision {result.model.revision.slice(0, 8)} ? local only</p>}
            <p>Records searched: {result.indexed_sources} earlier text sources. The selected visit and all later visits were excluded.</p>
            <ul>{result.result.limitations?.map((item: string) => <li key={item}>{item}</li>)}</ul>
          </details>
        </section>
      )}

      <section className="panel section" aria-labelledby="memory-evaluation-title">
        <div className="panel-heading">
          <div><h2 id="memory-evaluation-title">Retrieval model experiment</h2><p>MedEmbed semantic search compared with exact keyword search on synthetic paraphrase queries.</p></div>
          <span className="soft-label">Software benchmark</span>
        </div>
        {experiment ? (
          <>
            <p><strong>{experiment.query_count} synthetic queries</strong>. This checks software behavior only; it is not clinical validation.</p>
            <div className="research-metrics">
              {[
                ["MedEmbed Recall@1", experiment.metrics_at_1.semantic.recall_at_k],
                ["Keyword Recall@1", experiment.metrics_at_1.keyword.recall_at_k],
                ["MedEmbed MRR", experiment.metrics_at_1.semantic.mrr],
                ["Keyword MRR", experiment.metrics_at_1.keyword.mrr],
              ].map(([label, value]: any) => <div key={label}><small>{label}</small><strong>{Number(value).toFixed(2)}</strong></div>)}
            </div>
            <p className="sub">Model: {experiment.model} ? pinned revision {experiment.model_revision.slice(0, 8)}. Scores measure retrieval ranking, not disease likelihood.</p>
          </>
        ) : experimentError ? <p role="status">Synthetic experiment metrics are unavailable: {experimentError}</p> : <p role="status">Loading recorded retrieval experiment?</p>}
      </section>
    </>
  );
}
