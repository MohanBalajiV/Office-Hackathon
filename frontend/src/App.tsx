import { useState } from 'react'
import { generateTests, createTestSubtask, uploadTestCasesFile } from './api'
import { GenerateRequest, GenerateResponse, TestCase } from './types'
import JiraConnector from './components/JiraConnector'
import JiraDropdown from './components/JiraDropdown'
import * as XLSX from 'xlsx'
import { getStories, getStoryDetails } from './api/jira'
import './styles/jira.css'

function App() {
  const [formData, setFormData] = useState<GenerateRequest>({
    storyTitle: '',
    acceptanceCriteria: '',
    description: '',
    additionalInfo: ''
  })
  const [results, setResults] = useState<GenerateResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedTestCases, setExpandedTestCases] = useState<Set<string>>(new Set())
  const [stories, setStories] = useState<any[]>([])
  const [loadingStories, setLoadingStories] = useState(false)
  const [storiesError, setStoriesError] = useState<string | null>(null)
  const [selectedStory, setSelectedStory] = useState<any | null>(null)
  const [checkedTestCases, setCheckedTestCases] = useState<Set<string>>(new Set())
  const [approvedTestCases, setApprovedTestCases] = useState<Set<string>>(new Set())
  const [rejectedTestCases, setRejectedTestCases] = useState<Set<string>>(new Set())

  const toggleTestCaseExpansion = (testCaseId: string) => {
    const newExpanded = new Set(expandedTestCases)
    if (newExpanded.has(testCaseId)) {
      newExpanded.delete(testCaseId)
    } else {
      newExpanded.add(testCaseId)
    }
    setExpandedTestCases(newExpanded)
  }

  const toggleCheckTestCase = (testCaseId: string) => {
    const newChecked = new Set(checkedTestCases)
    if (newChecked.has(testCaseId)) {
      newChecked.delete(testCaseId)
    } else {
      newChecked.add(testCaseId)
    }
    setCheckedTestCases(newChecked)
  }

  const handleApproveTestCase = (testCaseId: string) => {
    const newApproved = new Set(approvedTestCases)
    const newRejected = new Set(rejectedTestCases)
    newApproved.add(testCaseId)
    newRejected.delete(testCaseId)
    setApprovedTestCases(newApproved)
    setRejectedTestCases(newRejected)
  }

  const handleRejectTestCase = (testCaseId: string) => {
    const newApproved = new Set(approvedTestCases)
    const newRejected = new Set(rejectedTestCases)
    newApproved.delete(testCaseId)
    newRejected.add(testCaseId)
    setApprovedTestCases(newApproved)
    setRejectedTestCases(newRejected)
  }

  const handleInputChange = (field: keyof GenerateRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.storyTitle.trim() || !formData.acceptanceCriteria.trim()) {
      setError('Story Title and Acceptance Criteria are required')
      return
    }

    setIsLoading(true)
    setError(null)
    
    try {
      const response = await generateTests(formData)
      setResults(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tests')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadStories() {
    setStoriesError(null)
    setLoadingStories(true)
    try {
      const data = await getStories()
      setStories(data || [])
    } catch (err: any) {
      setStoriesError(err?.response?.data?.message || err.message || 'Failed to load stories')
    } finally {
      setLoadingStories(false)
    }
  }

  async function handleLinkStory(key: string) {
    setSelectedStory(null)
    try {
      const details = await getStoryDetails(key)
      setSelectedStory(details)
      // populate form fields from selected story
      if (details.title) handleInputChange('storyTitle', details.title)
      if (details.description) handleInputChange('description', details.description)
      if (details.acceptanceCriteria) handleInputChange('acceptanceCriteria', details.acceptanceCriteria)
    } catch (err: any) {
      setSelectedStory({ title: 'Error', description: `<p>${err.message}</p>` })
    }
  }

  const handleCompleteReview = () => {
    if (results.cases) {
      const approvedCases = results.cases.filter(testCase => approvedTestCases.has(testCase.id))
      setResults({ ...results, cases: approvedCases })
      setCheckedTestCases(new Set())
      setApprovedTestCases(new Set())
      setRejectedTestCases(new Set())
    }
  }

  const handleDownloadExcel = () => {
    if (!results.cases || results.cases.length === 0) return

    // Prepare data for Excel
    const excelData = results.cases.map((testCase, index) => ({
      'TC ID': testCase.id,
      'Title': testCase.title,
      'Category': testCase.category,
      'Steps': testCase.steps.join(' | '),
      'Test Data': testCase.testData || 'N/A',
      'Expected Result': testCase.expectedResult,
      'Status': approvedTestCases.has(testCase.id) ? 'Approved' : rejectedTestCases.has(testCase.id) ? 'Rejected' : 'Not Reviewed'
    }))

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Test Cases')

    // Set column widths
    worksheet['!cols'] = [
      { wch: 10 },  // TC ID
      { wch: 40 },  // Title
      { wch: 15 },  // Category
      { wch: 50 },  // Steps
      { wch: 20 },  // Test Data
      { wch: 40 },  // Expected Result
      { wch: 15 }   // Status
    ]

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `TestCases_${timestamp}.xlsx`

    // Download the file
    XLSX.writeFile(workbook, filename)
  }

  const handleCreateSubtaskWithFile = async () => {
    if (!selectedStory?.key) {
      alert('Please select a user story first')
      return
    }

    if (!results.cases || results.cases.length === 0) {
      alert('Please generate test cases first')
      return
    }

    try {
      // Generate Excel file in memory
      const excelData = results.cases.map((testCase) => ({
        'TC ID': testCase.id,
        'Title': testCase.title,
        'Category': testCase.category,
        'Steps': testCase.steps.join(' | '),
        'Test Data': testCase.testData || 'N/A',
        'Expected Result': testCase.expectedResult,
        'Status': approvedTestCases.has(testCase.id) ? 'Approved' : rejectedTestCases.has(testCase.id) ? 'Rejected' : 'Not Reviewed'
      }))

      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Test Cases')
      worksheet['!cols'] = [
        { wch: 10 }, { wch: 40 }, { wch: 15 }, { wch: 50 }, { wch: 20 }, { wch: 40 }, { wch: 15 }
      ]

      // Convert to base64 using XLSX built-in base64 output
      const base64Data = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' })

      if (!base64Data || base64Data.length === 0) {
        throw new Error('Failed to convert Excel file to base64')
      }

      console.log('Base64 data generated successfully, length:', base64Data.length)

      // Step 1: Create subtask
      console.log('Creating subtask for story:', selectedStory.key)
      const subtaskRes = await createTestSubtask(
        selectedStory.key,
        `Generated ${results.cases.length} test cases for this user story`
      )
      console.log('Subtask created:', subtaskRes.subtaskKey)

      // Step 2: Upload Excel file to subtask
      console.log('Uploading file to subtask:', subtaskRes.subtaskKey)
      await uploadTestCasesFile(
        subtaskRes.subtaskKey,
        `TestCases_${selectedStory.key}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        base64Data
      )

      alert(`Subtask created successfully: ${subtaskRes.subtaskKey}\nTest cases file has been attached.`)
    } catch (error: any) {
      console.error('Error creating subtask:', error)
      const errorMsg = error?.response?.data?.message || error?.response?.data?.error || error.message || 'Unknown error'
      const details = error?.response?.data?.details ? `\n\nDetails: ${JSON.stringify(error.response.data.details)}` : ''
      alert(`Error: ${errorMsg}${details}`)
    }
  }

  return (
    <div>
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          background-color: #f5f5f5;
          color: #333;
          line-height: 1.6;
        }
        
        .container {
          max-width: 95%;
          width: 100%;
          margin: 0 auto;
          padding: 20px;
          min-height: 100vh;
        }
        
        @media (min-width: 768px) {
          .container {
            max-width: 90%;
            padding: 30px;
          }
        }
        
        @media (min-width: 1024px) {
          .container {
            max-width: 85%;
            padding: 40px;
          }
        }
        
        @media (min-width: 1440px) {
          .container {
            max-width: 1800px;
            padding: 50px;
          }
        }
        
        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        
        /* logo removed */
        
        .title {
          font-size: 2.5rem;
          color: #2c3e50;
          margin-bottom: 10px;
        }
        
        .subtitle {
          color: #666;
          font-size: 1.1rem;
        }
        
        .form-container {
          background: white;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          margin-bottom: 30px;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
          color: #2c3e50;
        }
        
        .form-input, .form-textarea {
          width: 100%;
          padding: 12px;
          border: 2px solid #e1e8ed;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        
        .form-input:focus, .form-textarea:focus {
          outline: none;
          border-color: #3498db;
        }
        
        .form-textarea {
          resize: vertical;
          min-height: 100px;
        }
        
        .submit-btn {
          background: #3498db;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .submit-btn:hover:not(:disabled) {
          background: #2980b9;
        }
        
        .submit-btn:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
        }
        
        .error-banner {
          background: #e74c3c;
          color: white;
          padding: 15px;
          border-radius: 6px;
          margin-bottom: 20px;
        }
        
        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
          font-size: 18px;
        }
        
        .results-container {
          background: white;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .results-header {
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e1e8ed;
        }
        
        .results-title {
          font-size: 1.8rem;
          color: #2c3e50;
          margin-bottom: 10px;
        }
        
        .results-meta {
          color: #666;
          font-size: 14px;
        }
        
        .table-container {
          overflow-x: auto;
        }
        
        .results-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        
        .results-table th,
        .results-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e1e8ed;
        }
        
        .results-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #2c3e50;
        }
        
        .results-table tr:hover {
          background: #f8f9fa;
        }
        
        .category-positive { color: #27ae60; font-weight: 600; }
        .category-negative { color: #e74c3c; font-weight: 600; }
        .category-edge { color: #f39c12; font-weight: 600; }
        .category-authorization { color: #9b59b6; font-weight: 600; }
        .category-non-functional { color: #34495e; font-weight: 600; }
        
        .test-case-id {
          cursor: pointer;
          color: #3498db;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 4px;
          transition: background-color 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        
        .test-case-id:hover {
          background: #f8f9fa;
        }
        
        .test-case-id.expanded {
          background: #e3f2fd;
          color: #1976d2;
        }
        
        .expand-icon {
          font-size: 10px;
          transition: transform 0.2s;
        }
        
        .expand-icon.expanded {
          transform: rotate(90deg);
        }
        
        .expanded-details {
          margin-top: 15px;
          background: #fafbfc;
          border: 1px solid #e1e8ed;
          border-radius: 8px;
          padding: 20px;
        }
        
        .step-item {
          background: white;
          border: 1px solid #e1e8ed;
          border-radius: 6px;
          padding: 15px;
          margin-bottom: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        
        .step-header {
          display: grid;
          grid-template-columns: 80px 1fr 1fr 1fr;
          gap: 15px;
          align-items: start;
        }
        
        .step-id {
          font-weight: 600;
          color: #2c3e50;
          background: #f8f9fa;
          padding: 4px 8px;
          border-radius: 4px;
          text-align: center;
          font-size: 12px;
        }
        
        .step-description {
          color: #2c3e50;
          line-height: 1.5;
        }
        
        .step-test-data {
          color: #666;
          font-style: italic;
          font-size: 14px;
        }
        
        .step-expected {
          color: #27ae60;
          font-weight: 500;
          font-size: 14px;
        }
        
        .step-labels {
          display: grid;
          grid-template-columns: 80px 1fr 1fr 1fr;
          gap: 15px;
          margin-bottom: 10px;
          font-weight: 600;
          color: #666;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
      
      <div className="container">
        <div className="header">
          <h1 className="title">Test Case Studio</h1>
          <p className="subtitle">Generate comprehensive test cases from your user stories</p>
        </div>
        
        <form onSubmit={handleSubmit} className="form-container">
          <div className="jira-controls" style={{ marginBottom: 12 }}>
            <JiraConnector onConnected={loadStories} />
            <JiraDropdown stories={stories} loading={loadingStories} error={storiesError || undefined} onLink={handleLinkStory} />
          </div>

          <div className="form-group">
            <label htmlFor="storyTitle" className="form-label">
              Story Title *
            </label>
            <input
              type="text"
              id="storyTitle"
              className="form-input"
              value={formData.storyTitle}
              onChange={(e) => handleInputChange('storyTitle', e.target.value)}
              placeholder="Enter the user story title..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Description
            </label>
            <textarea
              id="description"
              className="form-textarea"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Additional description (optional)..."
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="acceptanceCriteria" className="form-label">
              Acceptance Criteria *
            </label>
            <textarea
              id="acceptanceCriteria"
              className="form-textarea"
              value={formData.acceptanceCriteria}
              onChange={(e) => handleInputChange('acceptanceCriteria', e.target.value)}
              placeholder="Enter the acceptance criteria..."
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="additionalInfo" className="form-label">
              Additional Info
            </label>
            <textarea
              id="additionalInfo"
              className="form-textarea"
              value={formData.additionalInfo}
              onChange={(e) => handleInputChange('additionalInfo', e.target.value)}
              placeholder="Any additional information (optional)..."
            />
          </div>
          
          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Generating...' : 'Generate'}
          </button>
        </form>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="loading">
            Generating test cases...
          </div>
        )}

        {results && (
          <div className="results-container">
            <div className="results-header">
              <h2 className="results-title">Generated Test Cases</h2>
              <div className="results-meta">
                {results.cases.length} test case(s) generated
                {results.model && ` • Model: ${results.model}`}
                {results.promptTokens > 0 && ` • Tokens: ${results.promptTokens + results.completionTokens}`}
              </div>
            </div>
            
            <div className="table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th style={{width: '50px'}}>Check</th>
                    <th>Test Case ID</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Expected Result</th>
                    <th style={{width: '200px'}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.cases.map((testCase: TestCase) => (
                    <>
                      <tr key={testCase.id}>
                        <td>
                          <input 
                            type="checkbox" 
                            checked={checkedTestCases.has(testCase.id)}
                            onChange={() => toggleCheckTestCase(testCase.id)}
                            style={{cursor: 'pointer', width: '18px', height: '18px'}}
                          />
                        </td>
                        <td>
                          <div 
                            className={`test-case-id ${expandedTestCases.has(testCase.id) ? 'expanded' : ''}`}
                            onClick={() => toggleTestCaseExpansion(testCase.id)}
                          >
                            <span className={`expand-icon ${expandedTestCases.has(testCase.id) ? 'expanded' : ''}`}>
                              ▶
                            </span>
                            {testCase.id}
                          </div>
                        </td>
                        <td>{testCase.title}</td>
                        <td>
                          <span className={`category-${testCase.category.toLowerCase()}`}>
                            {testCase.category}
                          </span>
                        </td>
                        <td>{testCase.expectedResult}</td>
                        <td>
                          <div style={{display: 'flex', gap: '8px'}}>
                            <button
                              onClick={() => handleApproveTestCase(testCase.id)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: approvedTestCases.has(testCase.id) ? '#27ae60' : '#f0f0f0',
                                color: approvedTestCases.has(testCase.id) ? 'white' : '#333',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                              }}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectTestCase(testCase.id)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: rejectedTestCases.has(testCase.id) ? '#e74c3c' : '#f0f0f0',
                                color: rejectedTestCases.has(testCase.id) ? 'white' : '#333',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '600',
                                transition: 'all 0.2s'
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedTestCases.has(testCase.id) && (
                        <tr key={`${testCase.id}-details`}>
                          <td colSpan={6}>
                            <div className="expanded-details">
                              <h4 style={{marginBottom: '15px', color: '#2c3e50'}}>Test Steps for {testCase.id}</h4>
                              <div className="step-labels">
                                <div>Step ID</div>
                                <div>Step Description</div>
                                <div>Test Data</div>
                                <div>Expected Result</div>
                              </div>
                              {testCase.steps.map((step, index) => (
                                <div key={index} className="step-item">
                                  <div className="step-header">
                                    <div className="step-id">S{String(index + 1).padStart(2, '0')}</div>
                                    <div className="step-description">{step}</div>
                                    <div className="step-test-data">{testCase.testData || 'N/A'}</div>
                                    <div className="step-expected">
                                      {index === testCase.steps.length - 1 ? testCase.expectedResult : 'Step completed successfully'}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '20px', textAlign: 'center', display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {results.cases && results.cases.length > 0 && (
                  <button
                    onClick={handleDownloadExcel}
                    style={{
                      padding: '12px 32px',
                      backgroundColor: '#3498db',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'background-color 0.3s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2980b9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3498db')}
                  >
                    📥 Download as Excel
                  </button>
                )}
                {results.cases && results.cases.length > 0 && (
                  <button
                    onClick={handleCreateSubtaskWithFile}
                    style={{
                      padding: '12px 32px',
                      backgroundColor: '#9b59b6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'background-color 0.3s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#8e44ad')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#9b59b6')}
                  >
                    📤 Create Jira Subtask
                  </button>
                )}
                {approvedTestCases.size > 0 && (
                  <button
                    onClick={handleCompleteReview}
                    style={{
                      padding: '12px 32px',
                      backgroundColor: '#27ae60',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'background-color 0.3s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#229954')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#27ae60')}
                  >
                    Complete ({approvedTestCases.size} Approved)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
