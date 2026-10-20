import Link from "next/link";
import type { ReactNode } from "react";
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const shapes: Record<string, ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="11" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="18" width="7" height="3" rx="1" />
      </>
    ),
    patients: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0112 0v3M16 5a3 3 0 010 6m2 4a5 5 0 013 4v2" />
      </>
    ),
    review: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V2h6v2M9 12l2 2 4-4M9 18h6" />
      </>
    ),
    records: (
      <>
        <path d="M3 7V5a2 2 0 012-2h5l2 3h7a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM8 12h8m-8 4h5" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9a3 3 0 016 0c0 2-3 2-3 4m0 4h.01" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    back: <path d="M19 12H5m5-5-5 5 5 5" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 001 1h14a1 1 0 001-1v-5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    shield: (
      <>
        <path d="m12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5z" />
        <path d="m8 11 3 3 5-6" />
      </>
    ),
    logout: (
      <>
        <path d="M9 3H4v18h5m5-14 5 5-5 5m-7-5h12" />
      </>
    ),
    menu: <path d="M3 6h18M3 12h18M3 18h18" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    file: (
      <>
        <path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10h.01" />
      </>
    ),
    save: (
      <>
        <path d="M4 3h13l3 3v15H4zM8 3v6h8V3M8 21v-7h8v7" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name] || shapes.file}
    </svg>
  );
}
export function Avatar({
  name,
  small = false,
}: {
  name: string;
  small?: boolean;
}) {
  return (
    <span className={"avatar" + (small ? " small" : "")} aria-hidden="true">
      {name
        .replace(/^Dr\.\s*/, "")
        .split(" ")
        .slice(0, 2)
        .map((s) => s[0])
        .join("")}
    </span>
  );
}
export function Status({ value }: { value?: string }) {
  const labels: Record<string, string> = {
    PENDING: "Awaiting review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    COMPLETED: "Transcribed",
    SILENCE: "No speech detected",
    PROCESSING: "Processing",
    FAILED: "Failed",
  };
  return (
    <span className={"status-pill " + (value || "NOT_STARTED").toLowerCase()}>
      <i />
      {labels[value || ""] || "Not started"}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 tabIndex={-1}>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  icon = "file",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Tip({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="task-tip">
      <Icon name="info" />
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}
export function formatDate(value: string, time = false) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value.length === 10 ? value + "T12:00:00" : value));
}
export function Sources({ items }: { items: any[] }) {
  return (
    <div className="source-list">
      {items.map((i) => (
        <article className="source-item" key={i.id}>
          <div className="source-heading">
            <span className="file-icon">
              <Icon name={i.kind === "audio" ? "mic" : "file"} />
            </span>
            <div>
              <strong>
                {i.filename ||
                  (
                    {
                      notes: "Consultation notes",
                      laboratory: "Laboratory information",
                      medication: "Medication context",
                    } as any
                  )[i.kind] ||
                  i.kind}
              </strong>
              <small>
                {formatDate(i.created, true)} · Source {i.id}
              </small>
            </div>
            {i.filename && (
              <a className="text-link" href={`/api/inputs/${i.id}/file`}>
                Download <Icon name="arrow" size={14} />
              </a>
            )}
          </div>
          {i.kind === "notes" ? (
            <dl className="note-summary">
              {Object.entries(JSON.parse(i.content))
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
            </dl>
          ) : (
            <p className="preserve">{i.content}</p>
          )}
        </article>
      ))}
    </div>
  );
}
export function EncounterRows({
  items,
  review = false,
}: {
  items: any[];
  review?: boolean;
}) {
  return (
    <div className="encounter-list">
      {items.map((e) => (
        <Link
          className="encounter-row"
          key={e.id}
          href={`/patients/${e.patient_id}/encounters/${e.id}/${review ? "review" : "consultation"}`}
        >
          <Avatar name={e.patient_name} />
          <div className="encounter-name">
            <strong>{e.patient_name}</strong>
            <span>
              {e.title} · {formatDate(e.date)}
            </span>
          </div>
          <Status value={e.draft_status} />
          <span className="row-open">
            {review ? "Review draft" : "Open encounter"}
            <Icon name="arrow" size={16} />
          </span>
        </Link>
      ))}
    </div>
  );
}
export const actionLabels: Record<string, string> = {
  SAVE_NOTES: "Consultation notes saved",
  SAVE_INPUT: "Clinical information added",
  UPLOAD: "Document uploaded",
  TRANSCRIBE: "Audio submitted for transcription",
  GENERATE: "Clinical draft prepared",
  MODIFY: "Draft revised",
  APPROVE: "Decision approved",
  REJECT: "Draft rejected",
  SIMULATED_FINDINGS: "Demo findings loaded",
};
