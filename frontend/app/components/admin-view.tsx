"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Avatar,
  Empty,
  Icon,
  PageHeading,
  Sources,
  Status,
  ZeestLogo,
  formatDate,
} from "./ui";

export function AdminView({ m }: { m: any }) {
  const [editing, setEditing] = useState<any>(null);
  const [consultationFor, setConsultationFor] = useState<any>(null);
  const [query, setQuery] = useState("");
  const [cameraFile, setCameraFile] = useState<File | null>(null);
  const data = m.adminData;
  const filteredPatients =
    data?.patients.filter((patient: any) =>
      `${patient.name} ${patient.id} ${patient.physician_name}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    ) || [];

  async function savePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = JSON.stringify({
      name: form.get("name"),
      info: form.get("info"),
      physician_id: Number(form.get("physician_id")),
    });
    await m.action(async () => {
      await m.api(
        editing ? `/admin/patients/${editing.id}` : "/admin/patients",
        {
          method: editing ? "PUT" : "POST",
          body,
        },
      );
      setEditing(null);
      formElement.reset();
      await m.reload();
      m.setMessage(
        editing
          ? "Patient record and assignment updated."
          : "Patient registered and assigned.",
      );
    });
  }

  async function createConsultation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await m.action(async () => {
      const consultation = await m.api(`/admin/patients/${consultationFor.id}/consultations`, {
        method: "POST",
        body: JSON.stringify({
          date: form.get("date"),
          title: form.get("title"),
          laboratory: form.get("laboratory_content"),
          medication: form.get("medication_content"),
        }),
      });
      let attachmentCount = 0;
      const reportText = String(form.get("clinical_report_text") || "").trim();
      if (reportText) {
        await m.api(`/admin/consultations/${consultation.id}/reports`, {
          method: "POST",
          body: JSON.stringify({ text: reportText }),
        });
        attachmentCount++;
      }
      for (const kind of ["imaging", "clinical_report", "laboratory", "medication", "document"]) {
        for (const value of form.getAll(kind)) {
          if (!(value instanceof File) || !value.size) continue;
          const upload = new FormData();
          upload.set("kind", kind);
          upload.set("file", value);
          await m.api(`/admin/consultations/${consultation.id}/uploads`, {
            method: "POST",
            body: upload,
          });
          attachmentCount++;
        }
      }
      if (cameraFile) {
        const upload = new FormData();
        upload.set("kind", "document");
        upload.set("file", cameraFile);
        await m.api(`/admin/consultations/${consultation.id}/uploads`, {
          method: "POST",
          body: upload,
        });
        attachmentCount++;
      }
      setConsultationFor(null);
      setCameraFile(null);
      formElement.reset();
      await m.reload();
      m.setMessage(
        attachmentCount
          ? `Consultation created with ${attachmentCount} clinical attachment${attachmentCount === 1 ? "" : "s"}.`
          : "Consultation created for the assigned physician.",
      );
    });
  }

  return (
    <div className="app-layout admin-layout">
      <aside className="sidebar admin-sidebar">
        <div className="brand">
          <span className="brand-symbol"><ZeestLogo size={38} /></span>
          <span className="brand-copy">
            Zeest<small>ADMINISTRATION</small>
          </span>
        </div>
        <p className="nav-heading">MANAGEMENT</p>
        <nav>
          <a className="active">
            <Icon name="patients" size={20} />
            Patient assignments
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-account">
            <Avatar name={m.user?.name || "Administrator"} small />
            <div>
              <strong>{m.user?.name}</strong>
              <small>Administrator</small>
            </div>
            <button
              className="icon-button"
              aria-label="Log Out"
              onClick={m.logout}
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <strong>Administration</strong>
            <span>/</span>
            <span>Patient assignments</span>
          </div>
          <div className="topbar-right">
            <Avatar name={m.user?.name || "Administrator"} small />
          </div>
        </header>
        <main id="main-content">
          {m.error && (
            <div className="notice error">
              <strong>Something needs attention</strong>
              <p>{m.error}</p>
            </div>
          )}
          {m.message && (
            <div className="notice success">
              <strong>Saved</strong>
              <p>{m.message}</p>
            </div>
          )}
          <PageHeading
            eyebrow="Administrative workspace"
            title="Patients and Assignments"
            description="Register synthetic patients, assign physicians and create consultations."
          />
          <div className="admin-grid">
            <section className="panel admin-form-panel">
              <div className="panel-heading">
                <div>
                  <h2>{editing ? "Edit patient" : "Register patient"}</h2>
                  <p>Maintain identity and physician ownership.</p>
                </div>
                {editing && (
                  <button onClick={() => setEditing(null)}>Cancel</button>
                )}
              </div>
              <form
                className="admin-form"
                onSubmit={savePatient}
                key={editing?.id || "new"}
              >
                <label>
                  Patient name
                  <input
                    name="name"
                    required
                    minLength={2}
                    defaultValue={editing?.name || ""}
                  />
                </label>
                <label>
                  Clinical profile
                  <textarea
                    name="info"
                    required
                    minLength={3}
                    rows={5}
                    defaultValue={editing?.info || ""}
                    placeholder="Age, allergies and relevant history"
                  />
                </label>
                <label>
                  Assigned physician
                  <select
                    name="physician_id"
                    required
                    defaultValue={editing?.physician_id || ""}
                  >
                    <option value="" disabled>
                      Select physician
                    </option>
                    {data?.physicians.map((doctor: any) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.name} · {doctor.email}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="primary" disabled={m.busy}>
                  <Icon name="save" size={16} />
                  {editing ? "Save changes" : "Register and assign"}
                </button>
              </form>
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Registered patients</h2>
                  <p>Assignments and consultation history</p>
                </div>
                <span className="count-tag">{data?.patients.length || 0}</span>
              </div>
              <div className="searchbar admin-search">
                <Icon name="search" size={18} />
                <input
                  aria-label="Search registered patients"
                  placeholder="Search by patient, reference or physician..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Clear patient search"
                    onClick={() => setQuery("")}
                  >
                    <Icon name="close" size={16} />
                  </button>
                )}
              </div>
              {!data ? (
                <div className="skeleton-panel" />
              ) : !data.patients.length ? (
                <Empty
                  title="No patients registered"
                  description="Register the first synthetic patient using the form."
                />
              ) : !filteredPatients.length ? (
                <Empty
                  icon="search"
                  title="No matching patients"
                  description="Try another patient name, reference or physician."
                  action={
                    <button onClick={() => setQuery("")}>Clear search</button>
                  }
                />
              ) : (
                <div className="admin-patient-list">
                  {filteredPatients.map((patient: any) => (
                    <article key={patient.id}>
                      <div className="toolbar">
                        <div className="identity">
                          <Avatar name={patient.name} />
                          <div>
                            <h3>{patient.name}</h3>
                            <small>
                              Patient {String(patient.id).padStart(4, "0")}
                            </small>
                          </div>
                        </div>
                        <span className="soft-label">
                          {patient.physician_name}
                        </span>
                      </div>
                      <p>{patient.info}</p>
                      <div className="consultation-summary">
                        <strong>
                          {patient.consultations.length} consultations
                        </strong>
                        {patient.consultations.slice(0, 3).map((item: any) => (
                          <details className="admin-consultation" key={item.id}>
                            <summary>
                              <span>
                                {formatDate(item.date)} · {item.title}
                              </span>
                              <Status value={item.lifecycle} />
                            </summary>
                            <p>
                              {item.inputs.length
                                ? `${item.inputs.length} clinical attachment${item.inputs.length === 1 ? "" : "s"}`
                                : "No clinical attachments supplied"}
                            </p>
                            {!!item.inputs.length && <Sources items={item.inputs} />}
                          </details>
                        ))}
                      </div>
                      <div className="actions">
                        <button onClick={() => setEditing(patient)}>
                          Edit / reassign
                        </button>
                        <button
                          className="primary"
                          onClick={() => setConsultationFor(patient)}
                        >
                          New consultation
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
          <footer>
            Zeest administrative workspace
            <span>Patient registration · Physician assignment</span>
          </footer>
        </main>
      </div>
      {consultationFor && (
        <div className="dialog-backdrop">
          <form
            className="modal inline-modal admin-form"
            onSubmit={createConsultation}
          >
            <h2>New consultation</h2>
            <p>
              Create a consultation for <strong>{consultationFor.name}</strong>.
              It will appear in the assigned physician’s workspace.
            </p>
            <label>
              Date
              <input
                type="date"
                name="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label>
              Title
              <input
                name="title"
                required
                minLength={3}
                defaultValue="Clinical consultation"
              />
            </label>
            <label>
              Laboratory information
              <textarea
                name="laboratory_content"
                rows={4}
                maxLength={20000}
                placeholder="Test name, value, unit, date and source"
              />
            </label>
            <label>
              Medication information
              <textarea
                name="medication_content"
                rows={4}
                maxLength={20000}
                placeholder="Medication, dose, frequency and source"
              />
            </label>
            <label>
              Enter clinical report text (run Report NLP extraction)
              <textarea
                name="clinical_report_text"
                rows={5}
                maxLength={100000}
                placeholder="Paste synthetic report text. The extractor will return source-linked mentions with assertion and context."
              />
            </label>
            <fieldset className="admin-attachments">
              <legend>Clinical attachments</legend>
              <p>
                Add available source material now. The assigned physician will
                see these files organised in Clinical Inputs.
              </p>
              <label>
                Chest X-ray image (Imaging Agent input)
                <input
                  type="file"
                  name="imaging"
                  accept=".png,.jpg,.jpeg"
                  multiple
                />
              </label>
              <label>
                Clinical report (run Report NLP extraction)
                <input
                  type="file"
                  name="clinical_report"
                  accept=".txt,.pdf,.html,.htm,.json,.csv"
                  multiple
                />
              </label>
              <label>
                Laboratory reports
                <input
                  type="file"
                  name="laboratory"
                  accept=".png,.jpg,.jpeg,.pdf,.txt"
                  multiple
                />
              </label>
              <label>
                Medication records
                <input
                  type="file"
                  name="medication"
                  accept=".png,.jpg,.jpeg,.pdf,.txt"
                  multiple
                />
              </label>
              <label>
                Other documents
                <input
                  type="file"
                  name="document"
                  accept=".png,.jpg,.jpeg,.pdf,.txt"
                  multiple
                />
              </label>
              <CameraCapture file={cameraFile} onChange={setCameraFile} />
              <small>PNG, JPEG, PDF or TXT · maximum 20 MB per file</small>
            </fieldset>
            <div className="actions right">
              <button
                type="button"
                onClick={() => {
                  setCameraFile(null);
                  setConsultationFor(null);
                }}
              >
                Cancel
              </button>
              <button className="primary" disabled={m.busy}>
                Create consultation
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function CameraCapture({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => () => stopCamera(), []);

  async function openCamera() {
    setError("");
    setPreview("");
    onChange(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError(
        "Camera access was blocked or no camera was found. Allow camera permission and try again.",
      );
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const captured = new File([blob], `document-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setPreview(URL.createObjectURL(blob));
        onChange(captured);
        stopCamera();
      },
      "image/jpeg",
      0.9,
    );
  }

  function close() {
    stopCamera();
    setOpen(false);
    if (preview) URL.revokeObjectURL(preview);
    setPreview("");
  }

  return (
    <div className="camera-input">
      <strong>Take a document picture</strong>
      <button type="button" className="btn" onClick={openCamera}>
        <Icon name="camera" size={16} /> Open live camera
      </button>
      {file && <small>Captured photo ready: {file.name}</small>}
      {error && <p className="inline-error">{error}</p>}
      {open && (
        <div className="camera-dialog" role="dialog" aria-modal="true" aria-label="Live camera">
          <div className="camera-card">
            <div className="panel-heading">
              <div>
                <h2>Document camera</h2>
                <p>Position the document clearly inside the frame.</p>
              </div>
              <button type="button" className="icon-button" aria-label="Close camera" onClick={close}>
                <Icon name="close" size={18} />
              </button>
            </div>
            {preview ? (
              <img className="camera-preview" src={preview} alt="Captured document preview" />
            ) : (
              <video ref={videoRef} className="camera-preview" autoPlay muted playsInline />
            )}
            <div className="actions right">
              {preview ? (
                <>
                  <button type="button" onClick={openCamera}>Retake</button>
                  <button type="button" className="primary" onClick={() => setOpen(false)}>Use photo</button>
                </>
              ) : (
                <button type="button" className="primary" onClick={capture}>
                  <Icon name="camera" size={17} /> Capture photo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
