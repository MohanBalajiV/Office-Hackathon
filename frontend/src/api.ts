import { GenerateRequest, GenerateResponse } from './types'
import axios from 'axios'

const API_BASE_URL = 'http://localhost:8080/api'

// Configure axios to send credentials with requests
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
})

export async function generateTests(request: GenerateRequest): Promise<GenerateResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-tests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data: GenerateResponse = await response.json()
    return data
  } catch (error) {
    console.error('Error generating tests:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred')
  }
}

export async function createTestSubtask(parentKey: string, description: string) {
  const response = await axiosInstance.post('/jira/create-test-subtask', {
    parentKey,
    description
  })
  return response.data
}

export async function uploadTestCasesFile(issueKey: string, fileName: string, fileData: string) {
  const response = await axiosInstance.post('/jira/upload-test-cases', {
    issueKey,
    fileName,
    fileData
  })
  return response.data
}