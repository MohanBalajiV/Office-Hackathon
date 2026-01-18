import axios from 'axios';

export type SessionCredentials = { baseUrl: string; authHeader: string };

type StorySummary = { key: string; summary: string };
type StoryDetails = {
  key: string;
  title: string;
  description?: string;         // plain text (AC removed if it lived in description)
  acceptanceCriteria?: string;  // plain text bullets
};

function requireConnection(creds?: SessionCredentials) {
  if (!creds || !creds.baseUrl || !creds.authHeader) throw new Error('Not connected to Jira');
}

async function request<T>(creds: SessionCredentials, url: string, params?: Record<string, any>) {
  try {
    const resp = await axios.get<T>(url, {
      params,
      timeout: 15000,
      headers: {
        'Authorization': creds.authHeader,
        'Accept': 'application/json',
        'User-Agent': 'user-story-to-tests/1.0'
      }
    });
    return resp.data;
  } catch (err: any) {
    // Surface useful debug info for auth / API migration errors
    const resp = err?.response;
    const status = resp?.status;
    const data = resp?.data;
    const msg = data?.errorMessages || data || err.message || 'Unknown error';
    const combined = status ? `HTTP ${status} - ${JSON.stringify(msg)}` : String(msg);
    const e = new Error(combined);
    // attach original for deeper inspection if needed
    (e as any).original = err;
    throw e;
  }
}

/* ----------------------- Issuetype discovery (fix) ----------------------- */
/** Returns all issue type names on the site that look like "story" (case-insensitive).
 * If none are found, falls back to ["Story"] so JQL never breaks on sites without "User Story". */
async function getStoryTypeNames(creds: SessionCredentials): Promise<string[]> {
  const url = `${creds.baseUrl}/rest/api/3/issuetype`;
  const all = await request<any[]>(creds, url);
  const names = (all || [])
    .map(t => String(t?.name || '').trim())
    .filter(Boolean);
  const storyish = Array.from(new Set(names.filter(n => /story/i.test(n))));
  return storyish.length ? storyish : ['Story'];
}

/** Returns the subtask issue type from the site */
async function getSubtaskIssueType(creds: SessionCredentials): Promise<{ id: string; name: string } | null> {
  try {
    const url = `${creds.baseUrl}/rest/api/3/issuetype`;
    const all = await request<any[]>(creds, url);
    const subtask = (all || []).find(t => {
      const name = String(t?.name || '').toLowerCase();
      return name === 'sub-task' || name === 'subtask';
    });
    
    if (subtask) {
      return { id: subtask.id, name: subtask.name };
    }
    return null;
  } catch (err) {
    console.error('Error fetching subtask issue type:', err);
    return null;
  }
}

/* -------------------- ADF (Atlassian Document Format) helpers ------------------- */

/** Extracts plain text from ADF format, with support for AC detection and separation */
function adfToPlain(adfJson: any): { description: string; acceptanceCriteria: string } {
  if (!adfJson || typeof adfJson !== 'object') return { description: '', acceptanceCriteria: '' };

  const content = adfJson.content || [];
  let beforeAC: string[] = [];
  let acContent: string[] = [];
  let foundACHeading = false;

  for (let i = 0; i < content.length; i++) {
    const node = content[i];
    const text = extractTextFromNode(node).trim();

    // Check if this node contains "Acceptance Criteria:" heading
    if (!foundACHeading && /^acceptance\s*criteria\s*:?\s*$/i.test(text)) {
      foundACHeading = true;
      continue; // Skip the heading itself
    }

    if (foundACHeading) {
      // After AC heading, collect all content
      if (text) acContent.push(text);
    } else {
      // Before AC heading, collect description
      if (text) beforeAC.push(text);
    }
  }

  return {
    description: beforeAC.join('\n').trim(),
    acceptanceCriteria: acContent.join('\n').trim()
  };
}

/** Recursively extracts text from ADF nodes */
function extractTextFromNode(node: any): string {
  if (!node) return '';

  const parts: string[] = [];

  // Handle text nodes
  if (node.type === 'text') {
    return node.text || '';
  }

  // Handle paragraphs
  if (node.type === 'paragraph') {
    const text = (node.content || []).map(extractTextFromNode).join('');
    return text;
  }

  // Handle bullet lists and list items
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return (node.content || [])
      .map((item: any) => extractTextFromNode(item))
      .join('\n');
  }

  if (node.type === 'listItem') {
    const text = (node.content || [])
      .map((item: any) => extractTextFromNode(item))
      .join(' ');
    return text.trim() ? `- ${text.trim()}` : '';
  }

  // Handle other block types
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromNode).join('\n');
  }

  return '';
}

/* -------------------- HTML -> plain text helpers ------------------- */

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

function htmlToPlain(html: string): string {
  if (!html) return '';
  let out = html;

  // normalize bullets & breaks before stripping tags
  out = out.replace(/<\/li>\s*<li>/gi, '</li>\n<li>');
  out = out.replace(/<li[^>]*>/gi, '\n- ');
  out = out.replace(/<\/li>/gi, '');
  out = out.replace(/<br\s*\/?>/gi, '\n');
  out = out.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  out = out.replace(/<p[^>]*>/gi, '');
  out = out.replace(/<\/p>/gi, '\n');

  // strip remaining tags
  out = out.replace(/<[^>]+>/g, '');

  // decode & clean
  out = decodeHtmlEntities(out)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return out;
}

/** Find a section whose HEADING text contains the given regex (e.g., /Acceptance\s*Criteria/i).
 * Works even if heading text is nested (e.g., <h3><strong>Acceptance Criteria</strong></h3>).
 * Returns { sectionHtml, withoutSectionHtml } or null if not found. */
function extractSectionByHeading(html: string, contains: RegExp) {
  if (!html) return null;
  const headingRegex = /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi;
  const headings: { start: number; end: number; text: string }[] = [];

  let m: RegExpExecArray | null;
  while ((m = headingRegex.exec(html)) !== null) {
    const raw = m[0];
    const text = htmlToPlain(raw).trim();
    headings.push({ start: m.index, end: m.index + raw.length, text });
  }

  let idx = -1;
  for (let i = 0; i < headings.length; i++) {
    if (contains.test(headings[i].text)) { idx = i; break; }
  }
  if (idx === -1) return null;

  const acHead = headings[idx];
  const sectionStart = acHead.end;
  const sectionEnd = (idx + 1 < headings.length) ? headings[idx + 1].start : html.length;

  const sectionHtml = html.slice(sectionStart, sectionEnd);
  const withoutSectionHtml = html.slice(0, acHead.start) + html.slice(sectionEnd);

  return { sectionHtml, withoutSectionHtml };
}

/* ------------------------- Public API calls ------------------------ */

export async function testConnection(creds: SessionCredentials): Promise<any> {
  requireConnection(creds);
  const url = `${creds.baseUrl}/rest/api/3/myself`;
  const me = await request<any>(creds, url);
  return { accountId: me.accountId, displayName: me.displayName, locale: me.locale };
}

/** Lists recent stories using only issuetype names that actually exist on your site. */
export async function getStories(creds: SessionCredentials): Promise<StorySummary[]> {
  requireConnection(creds);
  // Use the newer JQL search endpoint per Atlassian migration notes
  const url = `${creds.baseUrl}/rest/api/3/search/jql`;

  // Build JQL only with valid issue types (fixes: "The value 'User Story' does not exist for 'issuetype'")
  const storyNames = await getStoryTypeNames(creds);
  const quoted = storyNames.map(n => `"${n.replace(/"/g, '\\"')}"`).join(', ');
  const jql = `issuetype in (${quoted}) ORDER BY created DESC`;
  const params = { jql, maxResults: 50, fields: 'summary,issuetype' };

  try {
  const data = await request<any>(creds, url, params);
    const issues = Array.isArray(data.issues) ? data.issues : [];
    return issues.map((i: any) => ({ key: i.key, summary: i.fields?.summary ?? '' }));
  } catch {
    // Fallback: broad search then filter client-side for story-like types
  const fallbackParams = { jql: 'ORDER BY created DESC', maxResults: 100, fields: 'summary,issuetype' };
  const data = await request<any>(creds, url, fallbackParams);
    const issues = (data.issues || []).filter((i: any) =>
      /story/i.test(String(i?.fields?.issuetype?.name || ''))
    );
    return issues.map((i: any) => ({ key: i.key, summary: i.fields?.summary ?? '' }));
  }
}

/** Returns a story with plain-text description and acceptanceCriteria (also plain text).
 * If AC is inside Description, we extract it and remove it from Description to avoid duplication. */
export async function getStory(creds: SessionCredentials, key: string): Promise<StoryDetails> {
  requireConnection(creds);
  const url = `${creds.baseUrl}/rest/api/3/issue/${encodeURIComponent(key)}`;
  const params = { expand: 'renderedFields,names', fields: '*all' };
  const data = await request<any>(creds, url, params);

  const title: string = data.fields?.summary ?? key;

  let descriptionPlain: string | undefined;
  let acPlain: string | undefined;

  // 1) Specific AC custom field (if configured)
  const configuredKey = process.env.JIRA_AC_FIELD_KEY; // e.g., "customfield_12345"

  if (configuredKey && data.fields?.hasOwnProperty(configuredKey)) {
    const v = data.fields[configuredKey];
    acPlain = (typeof v === 'string') ? htmlToPlain(v) : htmlToPlain(JSON.stringify(v));
  }

  // 2) Auto-discover AC field by visible name
  if (!acPlain) {
    const names = data.names || {};
    for (const fieldId of Object.keys(names)) {
      const label = String(names[fieldId] || '').toLowerCase();
      if (label.includes('acceptance') && label.includes('criteria')) {
        const v = data.fields?.[fieldId];
        if (v != null) {
          acPlain = typeof v === 'string' ? htmlToPlain(v) : htmlToPlain(JSON.stringify(v));
          break;
        }
      }
    }
  }

  // 3) Try to extract from description - handle ADF format first
  if (!acPlain && data.fields?.description) {
    const desc = data.fields.description;
    
    // Check if it's ADF format (JSON object with "type":"doc")
    if (typeof desc === 'object' && desc.type === 'doc' && Array.isArray(desc.content)) {
      const { description: desc_part, acceptanceCriteria: ac_part } = adfToPlain(desc);
      descriptionPlain = desc_part;
      acPlain = ac_part;
    } else if (typeof desc === 'string') {
      // Try to parse as JSON first (ADF stored as string)
      try {
        const parsed = JSON.parse(desc);
        if (parsed.type === 'doc' && Array.isArray(parsed.content)) {
          const { description: desc_part, acceptanceCriteria: ac_part } = adfToPlain(parsed);
          descriptionPlain = desc_part;
          acPlain = ac_part;
        } else {
          // Parsed JSON but not ADF format, treat as plain text
          descriptionPlain = desc;
        }
      } catch {
        // Not JSON, treat as plain text
        descriptionPlain = desc;
      }
    }
  }

  // 4) Try HTML rendered description if AC still not found
  if (!acPlain && data.renderedFields?.description) {
    const renderedDesc = data.renderedFields.description;
    const picked = extractSectionByHeading(renderedDesc, /acceptance\s*criteria/i);
    if (picked && picked.sectionHtml) {
      acPlain = htmlToPlain(picked.sectionHtml);
      descriptionPlain = htmlToPlain(picked.withoutSectionHtml);
    } else if (!descriptionPlain) {
      descriptionPlain = htmlToPlain(renderedDesc);
    }
  }

  // 5) Finalize: use rendered or fallback to raw
  if (!descriptionPlain) {
    if (data.renderedFields?.description) {
      descriptionPlain = htmlToPlain(data.renderedFields.description);
    } else if (typeof data.fields?.description === 'string') {
      descriptionPlain = data.fields.description.trim();
    } else if (data.fields?.description) {
      descriptionPlain = htmlToPlain(JSON.stringify(data.fields.description));
    }
  }

  return {
    key,
    title,
    description: descriptionPlain || '',
    acceptanceCriteria: acPlain || ''
  };
}

async function createSubtask(creds: SessionCredentials, parentKey: string, summary: string, description: string): Promise<string> {
  requireConnection(creds);
  
  try {
    // Get parent issue to verify it exists and get project key
    const parentUrl = `${creds.baseUrl}/rest/api/3/issue/${parentKey}`;
    let parentData: any;
    try {
      parentData = await request<any>(creds, parentUrl);
    } catch (err) {
      throw new Error(`Parent issue ${parentKey} not found or not accessible`);
    }
    
    const projectKey = parentData.key.split('-')[0];

    // Get the valid subtask issue type for this Jira instance
    const subtaskType = await getSubtaskIssueType(creds);
    if (!subtaskType) {
      throw new Error('Subtask issue type not found in this Jira instance. Please check that Sub-task issue type is enabled.');
    }

    console.log('Using subtask issue type:', subtaskType);

    // Create subtask with minimal required fields
    const createUrl = `${creds.baseUrl}/rest/api/3/issue`;
    const subtaskData = {
      fields: {
        project: { key: projectKey },
        parent: { key: parentKey },
        summary: summary,
        issuetype: { id: subtaskType.id }
      }
    };

    console.log('Creating subtask with data:', JSON.stringify(subtaskData));

    const response = await axios.post<any>(createUrl, subtaskData, {
      timeout: 15000,
      headers: {
        'Authorization': creds.authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'user-story-to-tests/1.0'
      }
    });

    console.log('Subtask created successfully:', response.data.key);
    return response.data.key;
  } catch (err: any) {
    const resp = err?.response;
    const status = resp?.status;
    const data = resp?.data;
    const msg = data?.errorMessages?.join(', ') || data?.errors || data?.message || err.message || 'Unknown error';
    const combined = status ? `HTTP ${status} - ${JSON.stringify(msg)}` : String(msg);
    console.error('Subtask creation failed:', combined);
    throw new Error(`Failed to create subtask: ${combined}`);
  }
}

async function uploadAttachment(creds: SessionCredentials, issueKey: string, fileName: string, fileBuffer: Buffer): Promise<void> {
  requireConnection(creds);

  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fileBuffer, fileName);

    const uploadUrl = `${creds.baseUrl}/rest/api/3/issue/${issueKey}/attachments`;
    
    await axios.post(uploadUrl, form, {
      timeout: 15000,
      headers: {
        'Authorization': creds.authHeader,
        'X-Atlassian-Token': 'no-check',
        'User-Agent': 'user-story-to-tests/1.0',
        ...form.getHeaders()
      }
    });
  } catch (err: any) {
    const resp = err?.response;
    const status = resp?.status;
    const data = resp?.data;
    const msg = data?.errorMessages || data || err.message || 'Unknown error';
    const combined = status ? `HTTP ${status} - ${JSON.stringify(msg)}` : String(msg);
    throw new Error(`Failed to upload attachment: ${combined}`);
  }
}

export default {
  testConnection,
  getStories,
  getStory,
  createSubtask,
  uploadAttachment
};
