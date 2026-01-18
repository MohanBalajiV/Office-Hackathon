import { useState } from "react";
import type { StorySummary } from "../api/jira";
import "../styles/jira.css";

type Props = {
  stories?: StorySummary[];
  loading?: boolean;
  error?: string | null;
  onLink: (key: string) => void;
};

export default function JiraDropdown({
  stories = [],
  loading = false,
  error = null,
  onLink,
}: Props) {
  const [selected, setSelected] = useState("");
  const hasOptions = stories.length > 0;

  function handleLink() {
    if (!selected) return;
    onLink(selected);
  }

  return (
    <div className="jira-dropdown">
      <div className="form-group">
        <label className="form-label" htmlFor="jira-story-select">
          Select User Story
        </label>
        <select
          id="jira-story-select"
          className="form-input"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={loading || !hasOptions}
        >
          <option value="">
            {hasOptions ? "-- choose a story --" : "No stories found"}
          </option>
          {stories.map((s) => (
            <option key={s.key} value={s.key}>
              {s.key} — {s.summary}
            </option>
          ))}
        </select>
      </div>

      <div className="jira-actions">
        <button
          className="btn"
          onClick={() => setSelected("")}
          disabled={loading || !selected}
        >
          Clear
        </button>
        <button
          className="submit-btn"
          onClick={handleLink}
          disabled={loading || !selected}
        >
          Link Story
        </button>
      </div>

      {/* Screen reader updates */}
      <div aria-live="polite" className="sr-only">
        {loading ? "Loading stories..." : error ? `Error: ${error}` : ""}
      </div>

      {loading && <div className="jira-loading">Loading stories…</div>}
      {error && <div className="jira-error">{error}</div>}
    </div>
  );
}
