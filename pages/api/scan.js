import { google } from 'googleapis'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { accessToken, accountEmail } = req.body
  if (!accessToken) return res.status(400).json({ error: 'Missing access token' })

  try {
    // 1. Fetch emails from Gmail
    const emails = await fetchInternshipEmails(accessToken)
    if (emails.length === 0) {
      return res.json({ applications: [], message: 'No internship emails found' })
    }

    // 2. Use Claude to classify each email
    const applications = await classifyEmails(emails, accountEmail)
    return res.json({ applications })
  } catch (err) {
    console.error('Scan error:', err)
    return res.status(500).json({ error: err.message })
  }
}

async function fetchInternshipEmails(accessToken) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  const gmail = google.gmail({ version: 'v1', auth })

  // Search for internship/job related emails from the last 6 months
  const sixMonthsAgo = Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000)
  const query = `(intern OR internship OR "job application" OR "your application" OR "application received" OR "application confirmation" OR "interview" OR "offer letter" OR "unfortunately" OR "we regret") after:${sixMonthsAgo}`

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 100,
  })

  const messages = listRes.data.messages || []

  // Fetch full content of each message
  const emails = await Promise.all(
    messages.slice(0, 50).map(async (msg) => {
      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      })

      const headers = full.data.payload.headers
      const subject = headers.find(h => h.name === 'Subject')?.value || ''
      const from = headers.find(h => h.name === 'From')?.value || ''
      const date = headers.find(h => h.name === 'Date')?.value || ''

      // Get snippet for context
      const snippet = full.data.snippet || ''

      return { id: msg.id, subject, from, date, snippet }
    })
  )

  return emails
}

async function classifyEmails(emails, accountEmail) {
  const emailData = emails.map(e =>
    `ID: ${e.id}\nFrom: ${e.from}\nDate: ${e.date}\nSubject: ${e.subject}\nSnippet: ${e.snippet}`
  ).join('\n\n---\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    system: `You are an internship application email classifier. 
Analyze emails and extract internship/job application data.

For each relevant email, extract:
- company: Company name (from email domain or body)
- role: Job title/position
- status: One of: Applied, Phone Screen, Interview, Final Round, Offer Received, Rejected, Waitlisted
- date: Date in YYYY-MM-DD format
- link: Best guess careers page URL based on the company (e.g. https://careers.company.com)
- emailId: The email ID provided
- confidence: high/medium/low

Rules:
- "application received/confirmed" → Applied
- "phone screen/call scheduled" → Phone Screen  
- "interview scheduled/invited" → Interview
- "final round/on-site" → Final Round
- "offer/congratulations" → Offer Received
- "unfortunately/not moving forward/other candidates" → Rejected
- "waitlist/future consideration" → Waitlisted

Only include emails that are clearly about job/internship applications.
Ignore newsletters, job alerts, and spam.

Return ONLY valid JSON, no markdown:
{
  "applications": [
    {
      "company": "string",
      "role": "string", 
      "status": "string",
      "date": "YYYY-MM-DD",
      "link": "string",
      "emailId": "string",
      "confidence": "string"
    }
  ]
}`,
    messages: [{
      role: 'user',
      content: `Classify these emails for account ${accountEmail}:\n\n${emailData}`
    }]
  })

  const text = response.content[0].text.trim()
    .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  const parsed = JSON.parse(text)

  // Deduplicate by company+role, keep most recent status
  const seen = new Map()
  for (const app of parsed.applications || []) {
    const key = `${app.company.toLowerCase()}-${app.role.toLowerCase()}`
    if (!seen.has(key) || new Date(app.date) > new Date(seen.get(key).date)) {
      seen.set(key, { ...app, accountEmail })
    }
  }

  return Array.from(seen.values())
}
