// React import not required with the new JSX transform
import type { StoryDetails } from "../api/jira";
import "../styles/jira.css";

type Props = {
  story?: StoryDetails | null;
};

/** Minimal HTML sanitizer (remove scripts, inline handlers, javascript:). 
 * For production, consider DOMPurify.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\sjavascript:/gi, " ");
}

export default function JiraDetailsCard({ story }: Props) {
  if (!story) return null;

  const title = story.title?.trim() || story.key;
  const desc = story.description ? sanitizeHtml(story.description) : null;
  const ac = story.acceptanceCriteria
    ? sanitizeHtml(story.acceptanceCriteria)
    : null;

  return (
    <section
      className="results-container"
      style={{ marginTop: 12 }}
      aria-labelledby={`story-${story.key}`}
    >
      <header className="results-header">
        <h3 id={`story-${story.key}`} className="results-title">
          {title}
        </h3>
        <div className="results-meta">
          Key: <strong>{story.key}</strong>
        </div>
      </header>

      {desc && (
        <div className="jira-section">
          <h5>Description</h5>
          <div className="jira-body" dangerouslySetInnerHTML={{ __html: desc }} />
        </div>
      )}

      {ac && (
        <div className="jira-section">
          <h5>Acceptance Criteria</h5>
          <div className="jira-body" dangerouslySetInnerHTML={{ __html: ac }} />
        </div>
      )}
    </section>
  );
}
