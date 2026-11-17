"use client";
import { useEffect, useState } from "react";
import { PageHeading } from "./ui";
type Result = { result: any; extraction: string; research_only: boolean };
type Metrics = {
  base_model: string;
  dataset: string;
  test_examples: number;
  metrics: {
    entity_precision: number;
    entity_recall: number;
    entity_f1: number;
    per_entity_type: Record<
      string,
      { precision: number; recall: number; f1: number }
    >;
  };
  limitations: string[];
};
function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
export function ReportExperimentsView({ m }: { m: any }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [method, setMethod] = useState("auto");
  const [result, setResult] = useState<Result | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    fetch("/api/research/report-experiments/results", {
      credentials: "same-origin",
    })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok)
          throw new Error(b.detail || "Experiment results are unavailable.");
        if (live) setMetrics(b);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, []);
  async function analyze(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      body.set("method", method);
      if (file) body.set("file", file);
      else body.set("text", text);
      const r = await fetch("/api/research/report-experiments/analyze", {
        method: "POST",
        body,
        credentials: "same-origin",
        headers: { "x-csrf-token": m.csrf },
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.detail || "Report analysis failed.");
      setResult(b);
    } catch (e: any) {
      setError(e.message || "Could not reach the local Report NLP module.");
    } finally {
      setBusy(false);
    }
  }
  const findings = result?.result?.findings || [];
  return (
    <>
      <PageHeading
        eyebrow="Local research tool"
        title="Report NLP experiments"
        description="Try the experimental report text extractor and inspect its source-linked output."
      />
      <div className="research-notice">
        <strong>Research experiment only</strong>
        <p>
          This local module extracts mentions from report text. It does not
          diagnose, predict a disease, or change consultation findings, drafts,
          or patient records. Use synthetic text only.
        </p>
      </div>
      <section className="panel section">
        <div className="panel-heading">
          <div>
            <h2>Test a report</h2>
            <p>
              Paste synthetic report text or upload a text-based report file.
            </p>
          </div>
          <span className="soft-label">Local model</span>
        </div>
        <form onSubmit={analyze}>
          <div className="field">
            <label htmlFor="report-text">Report text</label>
            <textarea
              id="report-text"
              rows={7}
              maxLength={100000}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setFile(null);
              }}
              placeholder="Example: The patient has a history of asthma. No evidence of pneumonia. Possible anemia."
            />
          </div>
          <div className="field">
            <label htmlFor="report-file">Or select a report file</label>
            <input
              id="report-file"
              type="file"
              accept=".txt,.pdf,.html,.htm,.json,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                if (e.target.files?.length) setText("");
              }}
            />
            <small>
              Text, HTML, JSON, CSV or PDF with selectable text. Scanned PDFs
              and images require separate processing.
            </small>
          </div>
          <div className="field">
            <label htmlFor="extractor-method">Extraction method</label>
            <select
              id="extractor-method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="auto">Rules plus trained local model</option>
              <option value="rules">Rules baseline only</option>
              <option value="model">Require trained model</option>
            </select>
          </div>
          <button
            className="primary"
            disabled={busy || (!file && !text.trim())}
          >
            {busy ? "Analyzing locally..." : "Analyze report text"}
          </button>
        </form>
        {error && (
          <p role="alert" className="research-error">
            {error}
          </p>
        )}
      </section>
      {result && (
        <section className="panel section" aria-live="polite">
          <div className="panel-heading">
            <div>
              <h2>Extracted mentions</h2>
              <p>
                Input: {result.result.provenance?.join(", ")} |{" "}
                {result.extraction}
              </p>
            </div>
            <span className="soft-label">Needs review</span>
          </div>
          {findings.length ? (
            <div className="findings-list">
              {findings.map((f: any) => (
                <article key={f.code}>
                  <div className="source-heading">
                    <strong>{f.label}</strong>
                    <small>
                      {f.assertion} | {f.value?.concept_type}
                    </small>
                  </div>
                  <p>{f.explanation}</p>
                  {f.value?.mentions?.map((v: any, i: number) => (
                    <p
                      className="preserve research-evidence"
                      key={`${f.code}-${i}`}
                    >
                      <strong>Source:</strong> ?{v.text}?
                      {v.page ? ` | Page ${v.page}` : ""} | {v.temporality},{" "}
                      {String(v.experiencer).replaceAll("_", " ")} | {v.method}
                      {v.extractor_score != null
                        ? ` | model score ${Number(v.extractor_score).toFixed(3)}`
                        : ""}
                    </p>
                  ))}
                </article>
              ))}
            </div>
          ) : (
            <p>
              No supported mentions were extracted. This is not evidence that a
              condition is absent.
            </p>
          )}
          <details className="research-limits">
            <summary>Method, status and limitations</summary>
            <p>Method: {result.result.method}</p>
            <p>
              Result status: {result.result.status} | Support:{" "}
              {result.result.support_status}
            </p>
            <ul>
              {result.result.limitations?.map((x: string) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </details>
        </section>
      )}
      <section className="panel section">
        <div className="panel-heading">
          <div>
            <h2>Training experiment</h2>
            <p>
              Fine-tuned biomedical encoder benchmark from the module result
              file.
            </p>
          </div>
          <span className="soft-label">Research metrics</span>
        </div>
        {metrics ? (
          <>
            <p>
              <strong>{metrics.base_model}</strong> fine-tuned on{" "}
              <strong>{metrics.dataset}</strong>; held-out test size:{" "}
              {metrics.test_examples.toLocaleString()} sentences.
            </p>
            <div className="research-metrics">
              {[
                ["Entity precision", metrics.metrics.entity_precision],
                ["Entity recall", metrics.metrics.entity_recall],
                ["Exact entity F1", metrics.metrics.entity_f1],
                ["Disease F1", metrics.metrics.per_entity_type.Disease?.f1],
                ["Chemical F1", metrics.metrics.per_entity_type.Chemical?.f1],
              ].map(([label, value]: any) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{pct(value)}</strong>
                </div>
              ))}
            </div>
            <p className="sub">
              Scores measure disease and chemical span extraction on PubMed
              abstracts, not clinical report accuracy. The model does not
              establish diagnoses.
            </p>
          </>
        ) : (
          <p>Loading recorded training results...</p>
        )}
      </section>
    </>
  );
}
