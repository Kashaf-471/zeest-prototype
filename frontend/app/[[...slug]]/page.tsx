"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, FormEvent } from "react";
import { wav, join, Job } from "../audio";
import { WorkspaceView } from "../components/workspace-view";
type Row = { id: number; [key: string]: any };
type Notes = {
  transcript: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};
const emptyNotes: Notes = {
  transcript: "",
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
};
export default function Workspace() {
  const params = useParams<{ slug?: string[] }>(),
    router = useRouter(),
    parts = params.slug || [],
    route = "/" + parts.join("/");
  const [user, setUser] = useState<Row | null>(null),
    [csrf, setCsrf] = useState(""),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [overview, setOverview] = useState<any>(null),
    [query, setQuery] = useState(""),
    [menuOpen, setMenuOpen] = useState(false),
    [noteTab, setNoteTab] = useState("transcript"),
    [authEmail, setAuthEmail] = useState(""),
    [authPassword, setAuthPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [savedNotes, setSavedNotes] = useState(JSON.stringify(emptyNotes)),
    [pendingHref, setPendingHref] = useState(""),
    [inputValues, setInputValues] = useState<Record<string, string>>({
      laboratory: "",
      medication: "",
    }),
    [lastEncounter, setLastEncounter] = useState<any>(null);
  const leaveDialog = useRef<HTMLDialogElement>(null),
    focusPending = useRef(true);
  const [patients, setPatients] = useState<Row[]>([]),
    [patientData, setPatientData] = useState<any>(null),
    [enc, setEnc] = useState<any>(null),
    [records, setRecords] = useState<any>(null),
    [history, setHistory] = useState<any>(null);
  const [notes, setNotes] = useState<Notes>(emptyNotes),
    [noteVersion, setNoteVersion] = useState(0),
    [tab, setTab] = useState("imaging"),
    [recordTab, setRecordTab] = useState("decisions"),
    [evidenceTab, setEvidenceTab] = useState("evidence"),
    [scenario, setScenario] = useState("respiratory"),
    [findings, setFindings] = useState<any[]>([]),
    [editing, setEditing] = useState(false),
    [diagnosis, setDiagnosis] = useState(""),
    [treatment, setTreatment] = useState(""),
    [confirm, setConfirm] = useState(""),
    [reason, setReason] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [recording, setRecording] = useState(false),
    [audioUrl, setAudioUrl] = useState(""),
    [speechStatus, setSpeechStatus] = useState("Ready to record"),
    [jobs, setJobs] = useState<Job[]>([]),
    [speechPending, setSpeechPending] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null),
    capture = useRef<any>(null),
    alive = useRef(true),
    queue = useRef(Promise.resolve()),
    liveTexts = useRef<Map<number, string>>(new Map()),
    recordRoute = useRef(""),
    cancelSpeech = useRef(false),
    speechEpoch = useRef(0),
    currentRoute = useRef(route);
  currentRoute.current = route;
  const isAuth = route === "/login" || route === "/signup",
    pid = parts[0] === "patients" ? Number(parts[1]) : 0,
    eid = parts[2] === "encounters" ? Number(parts[3]) : 0,
    screen = parts[4] || "consultation",
    base = `/patients/${pid}/encounters/${eid}`;
  async function api(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData) && options.body)
      headers.set("Content-Type", "application/json");
    if (csrf) headers.set("X-CSRF-Token", csrf);
    const res = await fetch("/api" + path, {
      ...options,
      headers,
      credentials: "same-origin",
    });
    let value: any;
    try {
      value = await res.json();
    } catch {
      throw new Error("Backend unavailable. Start FastAPI on port 8000.");
    }
    if (!res.ok) {
      if (res.status === 401 && !isAuth) {
        setUser(null);
        router.replace("/login");
      }
      throw new Error(
        typeof value.detail === "string"
          ? value.detail
          : Array.isArray(value.detail)
            ? value.detail
                .map((issue: any) => issue.msg.replace("Value error, ", ""))
                .join(". ")
            : "The request could not be completed. Please try again.",
      );
    }
    return value;
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function reload() {
    if (eid) {
      const [value, savedRecords, savedHistory, summary] = await Promise.all([
        api(`/encounters/${eid}`),
        api(`/encounters/${eid}/records`),
        api(`/encounters/${eid}/history`),
        api("/workspace"),
      ]);
      if (currentRoute.current !== route) return;
      if (value.patient.id !== pid)
        throw new Error("Encounter does not belong to selected patient.");
      setEnc(value);
      setOverview(summary);
      setPatients(summary.patients);
      setNoteVersion(value.encounter.version);
      const saved = value.inputs.filter((x: Row) => x.kind === "notes").at(-1);
      setNotes(
        saved ? { ...emptyNotes, ...JSON.parse(saved.content) } : emptyNotes,
      );
      setSavedNotes(
        JSON.stringify(
          saved ? { ...emptyNotes, ...JSON.parse(saved.content) } : emptyNotes,
        ),
      );
      setLastEncounter({
        href: `/patients/${pid}/encounters/${eid}/consultation`,
        name: value.patient.name,
        date: value.encounter.date,
      });
      localStorage.setItem(
        `zeest-last-${user?.id}`,
        JSON.stringify({
          href: `/patients/${pid}/encounters/${eid}/consultation`,
          name: value.patient.name,
          date: value.encounter.date,
        }),
      );
      setJobs(value.jobs);
      setFindings(
        value.findings.map((f: Row) => ({
          input_id: f.input_id,
          kind: `${f.scenario} | saved version ${f.source_version}`,
          finding: f.content,
        })),
      );
      const d = value.drafts[0];
      setDiagnosis(d?.diagnosis || "");
      setTreatment(d?.treatment || "");
      setRecords(savedRecords);
      setHistory(savedHistory);
    } else if (pid) {
      const value = await api(`/patients/${pid}`);
      if (currentRoute.current === route) setPatientData(value);
    } else if (!isAuth) {
      const value = await api("/workspace");
      if (currentRoute.current === route) {
        setOverview(value);
        setPatients(value.patients);
      }
    }
  }
  useEffect(() => {
    alive.current = true;
    fetch("/api/auth/me")
      .then(async (r) => {
        if (r.ok) {
          const v = await r.json();
          setUser(v.physician);
          setCsrf(v.csrf);
          if (route === "/" || isAuth) router.replace("/dashboard");
        } else if (!isAuth) router.replace("/login");
      })
      .catch(() =>
        setError("Cannot reach backend. Start FastAPI on port 8000."),
      )
      .finally(() => setReady(true));
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setError("");
    setMessage("");
    setEnc(null);
    setPatientData(null);
    setFindings([]);
    setEditing(false);
    setTab("imaging");
    setQuery("");
    setMenuOpen(false);
    setInputValues({ laboratory: "", medication: "" });
    setNoteTab("transcript");
    focusPending.current = true;
    if (user) {
      try {
        setLastEncounter(
          JSON.parse(localStorage.getItem(`zeest-last-${user.id}`) || "null"),
        );
      } catch {
        setLastEncounter(null);
      }
    }
    if (user && !isAuth) action(reload);
  }, [route, user?.id]);
  useEffect(() => {
    speechEpoch.current++;
    cancelSpeech.current = true;
    setSpeechPending(0);
    setAudioUrl("");
    setSpeechStatus("Ready to record");
  }, [route]);
  useEffect(() => {
    if (confirm) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirm]);
  useEffect(
    () => () => {
      cancelSpeech.current = true;
      const c = capture.current;
      if (c) {
        c.stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
        c.node.disconnect();
        c.context.close();
      }
    },
    [],
  );
  useEffect(() => {
    if (capture.current && route !== recordRoute.current) {
      cancelSpeech.current = true;
      const c = capture.current;
      c.stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      c.node.disconnect();
      c.context.close();
      capture.current = null;
      setRecording(false);
      setAudioLevel(0);
      setSpeechStatus("Recording cancelled after navigation.");
    }
  }, [route]);
  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );
  async function auth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action(async () => {
      const value = await api(
        "/auth/" + (route === "/signup" ? "register" : "login"),
        { method: "POST", body: JSON.stringify(Object.fromEntries(f)) },
      );
      if (route === "/signup") {
        router.push("/login");
        setMessage(value.message);
      } else {
        setOverview(null);
        setPatients([]);
        setPatientData(null);
        setEnc(null);
        setRecords(null);
        setHistory(null);
        setLastEncounter(null);
        setUser(value.physician);
        setCsrf(value.csrf);
        router.push("/dashboard");
      }
    });
  }
  const post = (path: string, value: any) =>
    api(path, { method: "POST", body: JSON.stringify(value) });
  async function poll(id: string, epoch: number): Promise<Job> {
    for (let n = 0; n < 600; n++) {
      if (cancelSpeech.current || epoch !== speechEpoch.current)
        throw new Error("Transcription display cancelled after navigation.");
      const j: Job = await api(`/jobs/${id}`);
      if (epoch !== speechEpoch.current)
        throw new Error("Transcription display cancelled after navigation.");
      setJobs((old) => [...old.filter((x) => x.id !== id), j]);
      if (j.status === "FAILED") throw new Error(j.error);
      if (j.status === "COMPLETED" || j.status === "SILENCE") return j;
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(
      "Transcription is still processing. Reload to inspect persisted status.",
    );
  }
  async function speech(
    file: Blob,
    stream: string,
    sequence: number,
    final: boolean,
    epoch: number,
  ) {
    if (epoch !== speechEpoch.current) return;
    const form = new FormData();
    form.set(
      "file",
      file,
      file instanceof File ? file.name : "consultation.wav",
    );
    form.set("stream", stream);
    form.set("sequence", String(sequence));
    const result = await api(`/encounters/${eid}/transcribe`, {
      method: "POST",
      body: form,
    });
    setSpeechStatus(
      final
        ? "Transcribing final audio locally..."
        : `Transcribing chunk ${sequence + 1} locally...`,
    );
    const j = await poll(result.id, epoch);
    if (epoch !== speechEpoch.current) return;
    const current = await api(`/encounters/${eid}`);
    if (epoch !== speechEpoch.current) return;
    setNoteVersion(current.encounter.version);
    if (final) {
      setNotes((n) => ({ ...n, transcript: j.transcript }));
      setSpeechStatus(
        j.status === "SILENCE"
          ? "No speech detected. Notes were not saved."
          : `Final transcript ready (${j.elapsed} ms). Review and save notes.`,
      );
    } else {
      liveTexts.current.set(sequence, j.transcript);
      setNotes((n) => ({
        ...n,
        transcript: [...liveTexts.current.entries()]
          .sort((a, b) => a[0] - b[0])
          .map((x) => x[1])
          .filter(Boolean)
          .join(" "),
      }));
      setSpeechStatus(
        `Chunk ${sequence + 1} recognised (${j.elapsed} ms). Recording continues.`,
      );
    }
  }
  function enqueue(
    blob: Blob,
    stream: string,
    sequence: number,
    final: boolean,
  ) {
    const epoch = speechEpoch.current;
    setSpeechPending((n) => n + 1);
    queue.current = queue.current
      .then(() => speech(blob, stream, sequence, final, epoch))
      .catch((e) => {
        if (epoch === speechEpoch.current) {
          setError(e.message);
          setSpeechStatus(
            "Transcription failed. Captured audio remains available.",
          );
        }
      })
      .finally(() => {
        if (epoch === speechEpoch.current)
          setSpeechPending((n) => Math.max(0, n - 1));
      });
  }
  async function start() {
    await action(async () => {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          "Microphone capture requires localhost and a supported browser. Use an audio file instead.",
        );
      cancelSpeech.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      });
      let context: AudioContext | undefined;
      try {
        context = new AudioContext();
        await context.resume();
        const source = context.createMediaStreamSource(stream),
          node = context.createScriptProcessor(4096, 1, 1),
          mute = context.createGain();
        mute.gain.value = 0;
        source.connect(node);
        node.connect(mute);
        mute.connect(context.destination);
        const state = {
          context,
          source,
          node,
          stream,
          all: [] as Float32Array[],
          pending: [] as Float32Array[],
          length: 0,
          total: 0,
          sequence: 0,
          id: crypto.randomUUID(),
          rate: context.sampleRate,
        };
        capture.current = state;
        recordRoute.current = route;
        queue.current = Promise.resolve();
        liveTexts.current.clear();
        setAudioUrl("");
        setSpeechStatus(
          "Recording. Local transcript updates in approximately 8-second chunks.",
        );
        setRecording(true);
        node.onaudioprocess = (event: AudioProcessingEvent) => {
          const samples = new Float32Array(event.inputBuffer.getChannelData(0));
          let power = 0;
          for (const sample of samples) power += sample * sample;
          setAudioLevel(Math.min(1, Math.sqrt(power / samples.length) * 8));
          state.all.push(samples);
          state.total += samples.length;
          state.pending.push(samples);
          state.length += samples.length;
          if (state.length >= state.rate * 8) {
            enqueue(
              wav(join(state.pending), state.rate),
              state.id,
              state.sequence++,
              false,
            );
            state.pending = [];
            state.length = 0;
          }
          if (state.total >= Math.min(state.rate * 180, 9000000)) {
            node.onaudioprocess = null;
            void stop();
            setMessage(
              "Recording reached the local size limit and was stopped.",
            );
          }
        };
      } catch (e) {
        stream.getTracks().forEach((t) => t.stop());
        await context?.close();
        throw e;
      }
    });
  }
  async function stop() {
    const c = capture.current;
    if (!c) return;
    c.node.onaudioprocess = null;
    c.node.disconnect();
    c.source.disconnect();
    c.stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    await c.context.close();
    capture.current = null;
    setRecording(false);
    setAudioLevel(0);
    const blob = wav(join(c.all), c.rate);
    setAudioUrl(URL.createObjectURL(blob));
    setSpeechStatus(
      "Recording stopped. Waiting for local transcript reconciliation...",
    );
    enqueue(blob, c.id + "-final", 0, true);
  }
  async function audioUpload(file: File) {
    cancelSpeech.current = false;
    const epoch = speechEpoch.current;
    setAudioUrl(URL.createObjectURL(file));
    setSpeechPending((n) => n + 1);
    try {
      await action(async () => {
        await speech(file, crypto.randomUUID(), 0, true, epoch);
      });
    } finally {
      if (epoch === speechEpoch.current)
        setSpeechPending((n) => Math.max(0, n - 1));
    }
  }
  const draft = enc?.drafts[0];
  const saveNotes = () =>
    action(async () => {
      await post(`/encounters/${eid}/notes`, {
        ...notes,
        expected_version: noteVersion,
      });
      await reload();
      setMessage("Notes saved as a new revision.");
    });
  async function doReview() {
    const choice = confirm;
    setConfirm("");
    await action(async () => {
      await post(`/encounters/${eid}/review`, {
        revision_id: draft.id,
        action: choice,
        reason,
      });
      await reload();
      setMessage(
        choice === "APPROVE"
          ? "Exact saved revision approved and recorded."
          : "Draft rejected. No accepted decision created.",
      );
    });
  }
  const dirty =
    !!eid &&
    !!enc &&
    (JSON.stringify(notes) !== savedNotes ||
      (editing &&
        (diagnosis !== draft?.diagnosis || treatment !== draft?.treatment)) ||
      Object.values(inputValues).some(Boolean));
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty || recording) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, recording]);
  useEffect(() => {
    if (pendingHref) leaveDialog.current?.showModal();
    else leaveDialog.current?.close();
  }, [pendingHref]);
  useEffect(() => {
    if (ready && !busy && focusPending.current) {
      const h = document.querySelector<HTMLElement>("main h1");
      if (h) {
        h.focus();
        focusPending.current = false;
      }
    }
  }, [ready, busy, route, enc, patientData, overview]);
  function onNavigateCapture(e: React.MouseEvent) {
    const a = (e.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href");
    if (
      href?.startsWith("/") &&
      !href.startsWith("/api") &&
      href !== route &&
      (dirty || recording) &&
      !e.metaKey &&
      !e.ctrlKey
    ) {
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
    }
  }
  const logout = () =>
    action(async () => {
      if (
        (dirty || recording) &&
        !window.confirm(
          "Log out and discard unsaved changes? Any active recording will stop.",
        )
      )
        return;
      await api("/auth/logout", { method: "POST" });
      setOverview(null);
      setPatients([]);
      setPatientData(null);
      setEnc(null);
      setRecords(null);
      setHistory(null);
      setLastEncounter(null);
      setNotes(emptyNotes);
      setSavedNotes(JSON.stringify(emptyNotes));
      setUser(null);
      setCsrf("");
      setAuthPassword("");
      router.push("/login");
    });
  const saveInput = (kind: string) =>
    action(async () => {
      await post(`/encounters/${eid}/inputs`, {
        kind,
        content: inputValues[kind],
      });
      setInputValues((v) => ({ ...v, [kind]: "" }));
      await reload();
      setMessage("Input saved with its source revision.");
    });
  const uploadFile = (file: File) =>
    action(async () => {
      const f = new FormData();
      f.set("file", file);
      await api(`/encounters/${eid}/uploads`, { method: "POST", body: f });
      await reload();
      setMessage("Upload saved. No simulated analysis mapped to this input.");
    });
  const loadFindings = () =>
    action(async () => {
      const v = await post(`/encounters/${eid}/findings`, { scenario });
      setFindings(v.findings);
      setMessage("Fixed scenario findings loaded.");
    });
  const generateDraft = () =>
    action(async () => {
      await post(`/encounters/${eid}/drafts`, { scenario });
      await reload();
      setEditing(false);
      setMessage("Simulated draft created from a saved source snapshot.");
    });
  const saveDraft = () =>
    action(async () => {
      await post(`/encounters/${eid}/review`, {
        revision_id: draft.id,
        action: "MODIFY",
        diagnosis,
        treatment,
      });
      await reload();
      setEditing(false);
      setMessage("New pending revision saved. No accepted decision created.");
    });
  const m = {
    user,
    ready,
    busy,
    error,
    setError,
    message,
    setMessage,
    route,
    isAuth,
    pid,
    eid,
    screen,
    base,
    patients,
    patientData,
    enc,
    records,
    history,
    overview,
    query,
    setQuery,
    menuOpen,
    setMenuOpen,
    noteTab,
    setNoteTab,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    showPassword,
    setShowPassword,
    notes,
    setNotes,
    noteVersion,
    tab,
    setTab,
    recordTab,
    setRecordTab,
    evidenceTab,
    setEvidenceTab,
    scenario,
    setScenario,
    findings,
    editing,
    setEditing,
    diagnosis,
    setDiagnosis,
    treatment,
    setTreatment,
    confirm,
    setConfirm,
    reason,
    setReason,
    recording,
    audioLevel,
    audioUrl,
    speechStatus,
    jobs,
    speechPending,
    dialog,
    leaveDialog,
    pendingHref,
    setPendingHref,
    lastEncounter,
    dirty,
    inputValues,
    setInputValues,
    auth,
    start,
    stop,
    audioUpload,
    saveNotes,
    doReview,
    action,
    reload,
    logout,
    saveInput,
    uploadFile,
    loadFindings,
    generateDraft,
    saveDraft,
    onNavigateCapture,
    draft,
    router,
  };
  return <WorkspaceView m={m} />;
}
