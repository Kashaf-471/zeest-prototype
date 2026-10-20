"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, Avatar } from "./ui";
import { OverviewView, PatientDetail } from "./overview-view";
import { EncounterView } from "./encounter-view";
export function WorkspaceView({ m }: { m: any }) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width:760px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobile || !m.menuOpen) return;
    const sidebar = document.querySelector<HTMLElement>(".sidebar");
    sidebar?.querySelector<HTMLElement>("a")?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        m.setMenuOpen(false);
        document.querySelector<HTMLElement>(".mobile-menu")?.focus();
      }
      if (e.key === "Tab" && sidebar) {
        const items = Array.from(
          sidebar.querySelectorAll<HTMLElement>("a,button:not(:disabled)"),
        );
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [mobile, m.menuOpen]);
  function tabKeys(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (
      target.getAttribute("role") !== "tab" ||
      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
    )
      return;
    const tabs = Array.from(
      target
        .closest("[role=tablist]")!
        .querySelectorAll<HTMLElement>("[role=tab]"),
    );
    let index = tabs.indexOf(target);
    index =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (index + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
            tabs.length;
    e.preventDefault();
    tabs[index].click();
    tabs[index].focus();
  }

  const nav = [
    ["/dashboard", "dashboard", "Dashboard"],
    ["/patients", "patients", "My Patients"],
    ["/reviews", "review", "Review Queue"],
    ["/records", "records", "Patient Records"],
  ];
  const section = m.pid
    ? "My Patients"
    : (
        {
          "/dashboard": "Overview",
          "/patients": "Patient directory",
          "/reviews": "Clinical worklist",
          "/records": "Longitudinal records",
          "/guide": "Help and orientation",
        } as any
      )[m.route] || "Workspace";
  return (
    <div
      className={m.isAuth ? "auth-layout" : "app-layout"}
      onClickCapture={m.onNavigateCapture}
      onKeyDown={tabKeys}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      {m.isAuth ? (
        <AuthView m={m} />
      ) : (
        <>
          <button
            className={"sidebar-scrim " + (m.menuOpen ? "visible" : "")}
            aria-label="Close navigation"
            onClick={() => m.setMenuOpen(false)}
            tabIndex={m.menuOpen ? 0 : -1}
          />
          <aside
            className={"sidebar " + (m.menuOpen ? "open" : "")}
            aria-label="Primary workspace navigation"
            inert={mobile && !m.menuOpen}
          >
            <Link className="brand" href="/dashboard">
              <span className="brand-symbol">+</span>
              <span>
                Zeest<small>PHYSICIAN WORKSPACE</small>
              </span>
            </Link>
            <p className="nav-heading">WORKSPACE</p>
            <nav aria-label="Main navigation">
              {nav.map(([href, icon, label]) => (
                <Link
                  key={href}
                  href={href}
                  className={
                    (
                      href === "/patients"
                        ? m.route.startsWith("/patients")
                        : m.route === href
                    )
                      ? "active"
                      : ""
                  }
                  aria-current={
                    (
                      href === "/patients"
                        ? m.route.startsWith("/patients")
                        : m.route === href
                    )
                      ? "page"
                      : undefined
                  }
                >
                  <Icon name={icon} size={20} />
                  <span>{label}</span>
                  {href === "/reviews" && m.overview?.metrics.pending > 0 && (
                    <b className="nav-count">{m.overview.metrics.pending}</b>
                  )}
                </Link>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <Link
                className={
                  "guide-link " + (m.route === "/guide" ? "active" : "")
                }
                href="/guide"
              >
                <Icon name="help" size={19} />
                Workspace Guide
                <Icon name="arrow" size={15} />
              </Link>
              <div className="sidebar-demo">
                <span className="demo-dot" />
                <div>
                  <strong>Local demo environment</strong>
                  <p>Simulated clinical analysis</p>
                </div>
              </div>
              <div className="sidebar-account">
                <Avatar name={m.user?.name || "Physician"} small />
                <div>
                  <strong>{m.user?.name || "Physician"}</strong>
                  <small>Physician</small>
                </div>
                <button
                  className="icon-button"
                  aria-label="Log Out"
                  title="Log Out"
                  disabled={m.busy || m.recording}
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
                <button
                  className="icon-button mobile-menu"
                  aria-label="Open navigation"
                  aria-expanded={m.menuOpen}
                  onClick={() => m.setMenuOpen(!m.menuOpen)}
                >
                  <Icon name="menu" />
                </button>
                <Link href="/dashboard">Workspace</Link>
                <span>/</span>
                <strong>{section}</strong>
              </div>
              <div className="topbar-right">
                <span className="local-status">
                  <i />
                  Local workspace
                </span>
                <Link href="/guide" className="icon-button" aria-label="Help">
                  <Icon name="help" size={21} />
                </Link>
                <span className="topbar-divider" />
                <Avatar name={m.user?.name || "Physician"} small />
              </div>
              {m.busy && (
                <div
                  className="loading-line"
                  role="status"
                  aria-label="Loading workspace data"
                />
              )}
            </header>
            <main id="main-content">
              <Notices m={m} />
              {!m.ready || !m.user ? (
                <div className="loading-workspace" role="status">
                  <span className="spinner" />
                  Loading your workspace...
                </div>
              ) : m.eid ? (
                <EncounterView m={m} />
              ) : m.pid ? (
                <PatientDetail m={m} />
              ) : (
                <OverviewView m={m} />
              )}
              <footer>
                Zeest physician workspace
                <span>Synthetic records · Local processing</span>
              </footer>
            </main>
          </div>
        </>
      )}
      <dialog
        ref={m.leaveDialog}
        className="modal"
        aria-labelledby="leave-title"
        onCancel={() => m.setPendingHref("")}
      >
        <span className="dialog-symbol">
          <Icon name="info" size={25} />
        </span>
        <h2 id="leave-title">Leave this page?</h2>
        <p>
          {m.recording
            ? "Your recording will stop. Unsaved audio and edits on this page may be lost."
            : "You have unsaved changes. Save them before leaving, or discard them to continue."}
        </p>
        <div className="actions right">
          <button autoFocus onClick={() => m.setPendingHref("")}>
            Stay here
          </button>
          <button
            className="danger"
            onClick={() => {
              const href = m.pendingHref;
              m.setPendingHref("");
              m.router.push(href);
            }}
          >
            Leave without saving
          </button>
        </div>
      </dialog>
    </div>
  );
}
function Notices({ m }: { m: any }) {
  return (
    <div className="notice-region" aria-label="Workspace messages">
      {m.error && (
        <div role="alert" className="notice error">
          <Icon name="info" size={20} />
          <div>
            <strong>Something needs attention</strong>
            <p>{m.error}</p>
          </div>
          <button
            className="icon-button"
            aria-label="Dismiss error"
            onClick={() => m.setError("")}
          >
            <Icon name="close" size={17} />
          </button>
        </div>
      )}
      {m.message && (
        <div role="status" className="notice success">
          <Icon name="check" size={20} />
          <p>{m.message}</p>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => m.setMessage("")}
          >
            <Icon name="close" size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
function AuthView({ m }: { m: any }) {
  return (
    <>
      <div className="auth-column">
        <Link href="/login" className="brand auth-brand">
          <span className="brand-symbol">+</span>
          <span>
            Zeest<small>PHYSICIAN WORKSPACE</small>
          </span>
        </Link>
        <main id="main-content" className="auth-main">
          <Notices m={m} />
          <div className="auth-heading">
            <span className="eyebrow">
              {m.route === "/signup" ? "Get started" : "Welcome back"}
            </span>
            <h1 tabIndex={-1}>
              {m.route === "/signup" ? "Create an account" : "Log in"}
            </h1>
            <p>
              {m.route === "/signup"
                ? "Set up your physician workspace."
                : "Continue to your patients and clinical workspace."}
            </p>
          </div>
          <form onSubmit={m.auth} className="auth-form">
            {m.route === "/signup" && (
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  required
                  placeholder="Dr. Full name"
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={m.authEmail}
                onChange={(e) => m.setAuthEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={m.showPassword ? "text" : "password"}
                  minLength={10}
                  maxLength={128}
                  autoComplete={
                    m.route === "/signup" ? "new-password" : "current-password"
                  }
                  required
                  placeholder="Enter your password"
                  value={m.authPassword}
                  onChange={(e) => m.setAuthPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={
                    m.showPassword ? "Hide password" : "Show password"
                  }
                  onClick={() => m.setShowPassword(!m.showPassword)}
                >
                  <Icon name="eye" size={19} />
                </button>
              </div>
              {m.route === "/signup" && (
                <p className="hint">Use at least 10 characters.</p>
              )}
            </div>
            <button className="primary auth-submit" disabled={m.busy}>
              {m.busy
                ? "Please wait..."
                : m.route === "/signup"
                  ? "Create Account"
                  : "Log In"}
              <Icon name="arrow" size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {m.route === "/signup" ? "Already registered?" : "New to Zeest?"}{" "}
            <Link href={m.route === "/signup" ? "/login" : "/signup"}>
              {m.route === "/signup" ? "Log In" : "Create an account"}
            </Link>
          </p>
          {m.route === "/login" ? (
            <details className="demo-access">
              <summary>Explore with a demo physician</summary>
              <p>Load a synthetic account, then select Log In.</p>
              <div className="demo-accounts">
                {[1, 2].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      m.setAuthEmail(`doctor${n}@example.com`);
                      m.setAuthPassword("ZeestDemo!2026");
                    }}
                  >
                    Physician {n}
                    <Icon name="arrow" size={15} />
                  </button>
                ))}
              </div>
            </details>
          ) : (
            <p className="hint">
              New accounts begin with an empty patient directory.
            </p>
          )}
          <div className="auth-security">
            <Icon name="shield" size={16} />
            Local access · Physician-owned records
          </div>
        </main>
        <div className="auth-copyright">Zeest · Local clinical prototype</div>
      </div>
      <aside className="auth-art">
        <div className="auth-art-overlay" />
        <div className="auth-art-caption">
          <span className="glass-label">
            <span className="demo-dot" />
            Local demo · Simulated clinical analysis
          </span>
          <h2>
            Your patient context.
            <br />
            One connected workspace.
          </h2>
          <p>
            Consultation notes, clinical inputs and physician decisions, brought
            together across encounters.
          </p>
          <div className="auth-pill-row">
            <span>
              <Icon name="mic" size={16} />
              Local transcription
            </span>
            <span>
              <Icon name="shield" size={16} />
              Physician review
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
