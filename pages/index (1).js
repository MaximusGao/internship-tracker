import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

const STATUS_CONFIG = {
  'Applied':        { badge: 'badge-applied',    dot: 'var(--accent)',  label: 'Applied' },
  'Phone Screen':   { badge: 'badge-screen',     dot: 'var(--yellow)',  label: 'Phone Screen' },
  'Interview':      { badge: 'badge-interview',  dot: 'var(--orange)',  label: 'Interview' },
  'Final Round':    { badge: 'badge-interview',  dot: 'var(--orange)',  label: 'Final Round' },
  'Offer Received': { badge: 'badge-offer',      dot: 'var(--green)',   label: 'Offer Received' },
  'Rejected':       { badge: 'badge-rejected',   dot: 'var(--red)',     label: 'Rejected' },
  'Waitlisted':     { badge: 'badge-waitlisted', dot: 'var(--purple)',  label: 'Waitlisted' },
}

function Badge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['Applied']
  return (
    <span className={`badge ${cfg.badge}`}>
      <span className="dot" style={{ background: cfg.dot }} />
      {status}
    </span>
  )
}

function ThemeToggle({ theme, setTheme }) {
  return (
    <button
      onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
      className="btn btn-ghost"
      style={{ fontSize: 16, padding: '6px 8px' }}
      title="Toggle theme"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 11, fontFamily: 'Geist Mono, monospace', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: color || 'var(--text)', lineHeight: 1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{sub}</div>}
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [theme, setTheme] = useState('light')
  const [accounts, setAccounts] = useState([])
  const [applications, setApplications] = useState([])
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  // Init theme + data
  useEffect(() => {
    const savedTheme = localStorage.getItem('interntrack_theme') || 'light'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)
    const a = localStorage.getItem('interntrack_apps')
    if (a) setApplications(JSON.parse(a))
    const b = localStorage.getItem('interntrack_accounts')
    if (b) setAccounts(JSON.parse(b))
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('interntrack_theme', theme)
  }, [theme])

  useEffect(() => { localStorage.setItem('interntrack_apps', JSON.stringify(applications)) }, [applications])
  useEffect(() => { localStorage.setItem('interntrack_accounts', JSON.stringify(accounts.map(a => ({ ...a, scanning: false })))) }, [accounts])

  // Handle OAuth callback
  useEffect(() => {
    if (!router.query.newAccount) return
    try {
      const { email, accessToken } = JSON.parse(decodeURIComponent(router.query.newAccount))
      setAccounts(prev => {
        const exists = prev.find(a => a.email === email)
        if (exists) return prev.map(a => a.email === email ? { ...a, accessToken } : a)
        showToast('✓ Added ' + email)
        return [...prev, { email, accessToken, scanning: false }]
      })
      router.replace('/', undefined, { shallow: true })
    } catch (e) {}
  }, [router.query.newAccount])

  function showToast(msg, d = 3000) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), d)
  }

  async function scanAccount(email) {
    const account = accounts.find(a => a.email === email)
    if (!account) return
    setAccounts(prev => prev.map(a => a.email === email ? { ...a, scanning: true } : a))
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: account.accessToken, accountEmail: email })
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Scan failed')
      const data = await res.json()
      const newApps = data.applications || []
      setApplications(prev => {
        const updated = [...prev]
        for (const app of newApps) {
          const idx = updated.findIndex(a =>
            a.company.toLowerCase() === app.company.toLowerCase() &&
            a.role.toLowerCase() === app.role.toLowerCase() &&
            a.accountEmail === app.accountEmail
          )
          if (idx >= 0) updated[idx] = { ...updated[idx], ...app, id: updated[idx].id }
          else updated.push({ ...app, id: Date.now() + Math.random() })
        }
        return updated
      })
      showToast(`Found ${newApps.length} applications`)
    } catch (err) {
      showToast('Error: ' + err.message, 5000)
    }
    setAccounts(prev => prev.map(a => a.email === email ? { ...a, scanning: false } : a))
  }

  async function scanAll() {
    for (const a of accounts) await scanAccount(a.email)
  }

  function removeAccount(email) {
    setAccounts(p => p.filter(a => a.email !== email))
    setApplications(p => p.filter(a => a.accountEmail !== email))
    showToast('Removed ' + email)
  }

  function removeApp(id) { setApplications(p => p.filter(a => a.id !== id)) }
  function updateStatus(id, status) { setApplications(p => p.map(a => a.id === id ? { ...a, status } : a)) }

  function exportCSV() {
    if (!applications.length) return showToast('Nothing to export')
    const rows = [['Company', 'Role', 'Status', 'Date', 'Link', 'Account'], ...applications.map(a => [a.company, a.role, a.status, a.date, a.link || '', a.accountEmail || ''])]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const el = document.createElement('a')
    el.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    el.download = 'internship-tracker.csv'
    el.click()
    showToast('Exported!')
  }

  const filtered = applications
    .filter(a => filter === 'all' || a.status === filter)
    .filter(a => !search || a.company?.toLowerCase().includes(search.toLowerCase()) || a.role?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sortBy === 'date' ? new Date(b.date) - new Date(a.date) :
      sortBy === 'company' ? a.company.localeCompare(b.company) :
      a.status.localeCompare(b.status)
    )

  const stats = {
    total: applications.length,
    active: applications.filter(a => ['Phone Screen', 'Interview', 'Final Round'].includes(a.status)).length,
    offers: applications.filter(a => a.status === 'Offer Received').length,
    rate: applications.length ? Math.round(applications.filter(a => a.status !== 'Applied').length / applications.length * 100) : 0,
  }

  const fmt = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

  const filters = ['all', 'Applied', 'Phone Screen', 'Interview', 'Final Round', 'Offer Received', 'Rejected', 'Waitlisted']

  return (
    <>
      <Head>
        <title>InternTrack</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎯</text></svg>" />
      </Head>

      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

        {/* Top Nav */}
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(8px)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🎯</span>
              <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.02em' }}>InternTrack</span>
              {accounts.length > 0 && (
                <span style={{ fontSize: 11, fontFamily: 'Geist Mono, monospace', color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '2px 8px' }}>
                  {accounts.length} account{accounts.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ThemeToggle theme={theme} setTheme={setTheme} />
              <button onClick={exportCSV} className="btn btn-secondary" style={{ fontSize: 12 }}>Export CSV</button>
              <button onClick={scanAll} disabled={!accounts.length} className="btn btn-primary" style={{ opacity: accounts.length ? 1 : 0.4 }}>
                {accounts.some(a => a.scanning) ? <><span className="spin">↻</span> Scanning</> : '⚡ Scan All'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>

          {/* Main Content */}
          <div>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              <StatCard label="Total" value={stats.total} sub="applications" />
              <StatCard label="Active" value={stats.active} sub="in progress" color="var(--orange)" />
              <StatCard label="Offers" value={stats.offers} sub="received" color="var(--green)" />
              <StatCard label="Response" value={`${stats.rate}%`} sub="rate" color="var(--accent)" />
            </div>

            {/* Search + Sort */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                type="text"
                placeholder="Search company or role..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, padding: '8px 12px' }}
              />
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '8px 10px', cursor: 'pointer' }}>
                <option value="date">Date</option>
                <option value="company">Company</option>
                <option value="status">Status</option>
              </select>
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
              {filters.map(f => {
                const count = f === 'all' ? applications.length : applications.filter(a => a.status === f).length
                const active = filter === f
                return (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{
                      fontFamily: 'Geist Mono, monospace', fontSize: 11, padding: '4px 10px',
                      borderRadius: 20, cursor: 'pointer', border: '1px solid',
                      background: active ? 'var(--text)' : 'transparent',
                      borderColor: active ? 'var(--text)' : 'var(--border)',
                      color: active ? 'var(--bg)' : 'var(--text2)',
                      transition: 'all 0.1s',
                    }}>
                    {f === 'all' ? 'All' : f} · {count}
                  </button>
                )
              })}
            </div>

            {/* Application List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 24px', border: '1px dashed var(--border)', borderRadius: 12 }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                  <div style={{ fontWeight: 500, marginBottom: 6 }}>No applications yet</div>
                  <div style={{ color: 'var(--text3)', fontSize: 13 }}>Add a Gmail account and click Scan All</div>
                </div>
              ) : filtered.map((app, i) => (
                <div key={app.id} className="card fade-up" style={{ padding: '14px 16px', animationDelay: `${i * 0.03}s`, cursor: 'default', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{app.company}</span>
                        {app.accountEmail && (
                          <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>
                            {app.accountEmail.split('@')[0]}
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 8 }}>{app.role}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--text3)' }}>{fmt(app.date)}</span>
                        {app.link && (
                          <a href={app.link} target="_blank" rel="noopener noreferrer"
                            style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}
                            onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.target.style.textDecoration = 'none'}>
                            ↗ careers page
                          </a>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                      <Badge status={app.status} />
                      <div style={{ display: 'flex', gap: 5 }}>
                        <select value={app.status} onChange={e => updateStatus(app.id, e.target.value)}
                          style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, padding: '4px 6px', cursor: 'pointer', borderRadius: 5 }}>
                          {Object.keys(STATUS_CONFIG).map(s => <option key={s}>{s}</option>)}
                        </select>
                        <button onClick={() => removeApp(app.id)}
                          style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, padding: '4px 8px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text3)', borderRadius: 5, cursor: 'pointer' }}
                          onMouseEnter={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.color = 'var(--red)' }}
                          onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text3)' }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 72 }}>

            {/* Accounts */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Accounts</span>
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--accent)' }}>{accounts.length} connected</span>
              </div>

              {accounts.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.6 }}>
                  Connect a Gmail account to start scanning for applications.
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: accounts.length ? 10 : 0 }}>
                {accounts.map(account => (
                  <div key={account.email} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, wordBreak: 'break-all', lineHeight: 1.3 }}>{account.email}</span>
                      <button onClick={() => removeAccount(account.email)}
                        style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, marginLeft: 6, flexShrink: 0 }}
                        onMouseEnter={e => e.target.style.color = 'var(--red)'}
                        onMouseLeave={e => e.target.style.color = 'var(--text3)'}>✕</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--text3)' }}>
                        {applications.filter(a => a.accountEmail === account.email).length} apps
                      </span>
                      <button onClick={() => scanAccount(account.email)} disabled={account.scanning}
                        style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, padding: '4px 10px', background: 'var(--accent-bg)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 5, cursor: account.scanning ? 'not-allowed' : 'pointer' }}>
                        {account.scanning ? <><span className="spin">↻</span> Scanning</> : '⚡ Scan'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <a href="/api/auth/google-url"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text2)', fontSize: 13, fontWeight: 500, textDecoration: 'none', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}>
                + Add Gmail Account
              </a>
            </div>

            {/* By Account Breakdown */}
            {accounts.length > 0 && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Breakdown</div>
                {accounts.map(account => {
                  const count = applications.filter(a => a.accountEmail === account.email).length
                  const offers = applications.filter(a => a.accountEmail === account.email && a.status === 'Offer Received').length
                  return (
                    <div key={account.email} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4, wordBreak: 'break-all' }}>{account.email}</div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--accent)' }}>{count} apps</span>
                        {offers > 0 && <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--green)' }}>🎉 {offers} offer{offers > 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Tips */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Tips</div>
              {[
                'Scan weekly to catch status updates',
                'Fix any status with the dropdown',
                'Add both personal & school email',
                'Export CSV anytime as a backup',
              ].map((tip, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, paddingLeft: 10, borderLeft: '2px solid var(--border)', lineHeight: 1.5 }}>{tip}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 500,
          padding: '10px 18px', borderRadius: 8, boxShadow: 'var(--shadow-lg)',
          whiteSpace: 'nowrap', zIndex: 100, animation: 'fadeUp 0.2s ease'
        }}>
          {toast}
        </div>
      )}
    </>
  )
}
