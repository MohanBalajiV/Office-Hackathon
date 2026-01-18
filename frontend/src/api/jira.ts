import axios from 'axios'

// If VITE_API_BASE is set (e.g., http://localhost:8080), use it; else rely on Vite proxy (/api/*)
const rawBase = (import.meta as any).env?.VITE_API_BASE?.trim() || ''
const baseURL = rawBase ? `${rawBase.replace(/\/$/, '')}/api/jira` : '/api/jira'

const api = axios.create({
  baseURL,
  timeout: 20000,
  // Send cookies so session-based Jira auth works
  withCredentials: true,
})

// Optional debug
// api.interceptors.request.use((cfg) => {
//   console.log('[Jira API] ->', cfg.method?.toUpperCase(), cfg.baseURL + (cfg.url || ''), cfg.data || '')
//   return cfg
// })

export interface JiraConnectPayload {
  baseUrl: string
  email: string
  apiToken: string
}

export async function connectJira(payload: JiraConnectPayload) {
  const res = await api.post('/connect', payload)
  return res.data
}

export interface StorySummary {
  key: string
  summary: string
}

export async function getStories(): Promise<StorySummary[]> {
  const res = await api.get('/stories')
  return res.data as StorySummary[]
}

export interface StoryDetails {
  key: string
  title: string
  description?: string
  acceptanceCriteria?: string
}

export async function getStoryDetails(key: string): Promise<StoryDetails> {
  const res = await api.get(`/story/${encodeURIComponent(key)}`)
  return res.data as StoryDetails
}

export default api
