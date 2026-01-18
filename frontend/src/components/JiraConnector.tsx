import React, { useEffect, useRef, useState } from "react";
import { connectJira } from "../api/jira";
import "../styles/jira.css";

type Props = {
  onConnected?: () => void;
};

export default function JiraConnector({ onConnected }: Props) {
  const [open, setOpen] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Use permissive checks; do NOT block submission due to strict regex.
  const isLikelyUrl = (v: string) => /^(https?:\/\/)?[^\s]+\.[^\s]+/i.test(v.trim());
  const isLikelyEmail = (v: string) => v.includes("@") && v.includes(".");

  // Allow submit as long as the fields are filled.
  const canSubmit = !loading && baseUrl.trim().length > 0 && email.trim().length > 0 && apiToken.length > 0;

  function normalizeBaseUrl(v: string) {
    const t = v.trim();
    if (/^https?:\/\//i.test(t)) return t.replace(/\/$/, "");
    return `https://${t}`.replace(/\/$/, "");
  }

  function resetForm() {
    setBaseUrl("");
    setEmail("");
    setApiToken("");
    setError(null);
    setShowToken(false);
  }

  useEffect(() => {
    if (open) {
      firstFieldRef.current?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [open]);

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) setOpen(false);
  }

  async function handleConnect(e?: React.FormEvent | React.MouseEvent) {
    e?.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError("Please fill all fields.");
      return;
    }

    setLoading(true);
    try {
      const url = normalizeBaseUrl(baseUrl);
      // Debug log to prove the handler fired (remove later if you want)
      console.log("[JiraConnector] Submitting connect:", { url, email: email.trim() });
      await connectJira({ baseUrl: url, email: email.trim(), apiToken });
      setOpen(false);
      resetForm();
      onConnected && onConnected();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Connection failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="jira-connector">
      <button
        className="btn btn-primary"
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
      >
        Connect Jira
      </button>

      {open && (
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="jira-modal-title">
            <div className="modal-header">
              <h3 id="jira-modal-title">Connect to Jira</h3>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setOpen(false)}
                disabled={loading}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Keep onSubmit AND also bind onClick on the submit button to guarantee firing */}
            <form className="jira-form form-container" onSubmit={handleConnect}>
              {error && <div className="error-banner">{error}</div>}

              <div className="form-group">
                <label className="form-label" htmlFor="jira-baseurl">Jira Base URL</label>
                <input
                  id="jira-baseurl"
                  ref={firstFieldRef}
                  className={`form-input ${baseUrl && !isLikelyUrl(baseUrl) ? "input-invalid" : ""}`}
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="your-domain.atlassian.net (protocol optional)"
                  required
                  inputMode="url"
                />
                {!!baseUrl && !isLikelyUrl(baseUrl) && (
                  <div className="field-hint">Example: your-domain.atlassian.net or https://your-domain.atlassian.net</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="jira-email">Email</label>
                <input
                  id="jira-email"
                  className={`form-input ${email && !isLikelyEmail(email) ? "input-invalid" : ""}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  inputMode="email"
                />
                {!!email && !isLikelyEmail(email) && (
                  <div className="field-hint">Enter a valid email address</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="jira-token">API Token</label>
                <div className="password-field">
                  <input
                    id="jira-token"
                    className="form-input"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder="API token"
                    type={showToken ? "text" : "password"}
                    required
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="btn btn-outline small"
                    onClick={() => setShowToken((v) => !v)}
                    aria-label={showToken ? "Hide API token" : "Show API token"}
                  >
                    {showToken ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="field-hint">
                  Create/manage tokens at <em>id.atlassian.com → Security → API tokens</em>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="submit-btn"
                  onClick={handleConnect}   /* <-- bulletproof: click calls handler even if onSubmit is intercepted */
                  disabled={!canSubmit}
                >
                  {loading ? "Connecting..." : "Connect"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
