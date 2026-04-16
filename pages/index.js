import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

const STATUS_CONFIG = {
  'Applied':        { color: 'badge-applied',    dot: '#5b8ef0' },
  'Phone Screen':   { color: 'badge-screen',     dot: '#f0c96b' },
  'Interview':      { color: 'badge-interview',  dot: '#f0a85b' },
  'Final Round':    { color: 'badge-interview',  dot: '#f0a85b' },
  'Offer Received': { color: 'badge-offer',      dot: '#7fd8be' },
  'Rejected':       { color: 'badge-rejected',   dot: '#f07070' },
  'Waitlisted':     { color: 'badge-waitlisted', dot: '#b4a0e6' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['Applied']
  return (
    <span className={`mono text-xs px-2 py-1 rounded-full flex items-center gap-1 ${cfg.color}`}>
      <span style={{ width:6,height:6,borderRadius:'50%',background:cfg.dot,display:'inline-block' }} />
      {status}
    </span>
  )
}

function StatCard({ label, value, color, sub }) {
  return (
    <div className="rounded-xl p-4 relative overflow-hidden" style={{ background:'#161c2e',border:'1px solid #252d45' }}>
      <div style={{ position:'absolute',top:0,left:0,right:0,height:2,background:color }} />
      <div className="mono text-xs mb-1" style={{ color:'#7a85a3',textTransform:'uppercase' }}>{label}</div>
      <div className="font-black text-3xl" style={{ color }}>{value}</div>
      {sub && <div className="mono text-xs mt-1" style={{ color:'#7a85a3' }}>{sub}</div>}
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const [accounts, setAccounts] = useState([])
  const [applications, setApplications] = useState([])
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const a = localStorage.getItem('interntrack_apps')
    if (a) setApplications(JSON.parse(a))
    const b = localStorage.getItem('interntrack_accounts')
    if (b) setAccounts(JSON.parse(b))
  }, [])

  useEffect(() => { localStorage.setItem('interntrack_apps', JSON.stringify(applications)) }, [applications])
  useEffect(() => { localStorage.setItem('interntrack_accounts', JSON.stringify(accounts.map(a=>({...a,scanning:false})))) }, [accounts])

  useEffect(() => {
    if (!router.query.newAccount) return
    try {
      const { email, accessToken } = JSON.parse(decodeURIComponent(router.query.newAccount))
      setAccounts(prev => {
        const exists = prev.find(a => a.email === email)
        if (exists) return prev.map(a => a.email === email ? {...a, accessToken} : a)
        showToast('Added ' + email)
        return [...prev, { email, accessToken, scanning: false }]
      })
      router.replace('/', undefined, { shallow: true })
    } catch(e) {}
  }, [router.query.newAccount])

  function showToast(msg, d=3000) { setToast(msg); setTimeout(()=>setToast(null),d) }

  async function scanAccount(email) {
    const account = accounts.find(a => a.email === email)
    if (!account) return
    setAccounts(prev => prev.map(a => a.email===email ? {...a,scanning:true} : a))
    try {
      const res = await fetch('/api/scan', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ accessToken: account.accessToken, accountEmail: email })
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Scan failed')
      const data = await res.json()
      const newApps = data.applications || []
      setApplications(prev => {
        const updated = [...prev]
        for (const app of newApps) {
          const idx = updated.findIndex(a =>
            a.company.toLowerCase()===app.company.toLowerCase() &&
            a.role.toLowerCase()===app.role.toLowerCase() &&
            a.accountEmail===app.accountEmail
          )
          if (idx >= 0) updated[idx] = {...updated[idx],...app,id:updated[idx].id}
          else updated.push({...app, id: Date.now()+Math.random()})
        }
        return updated
      })
      showToast('Found ' + newApps.length + ' apps from ' + email)
    } catch(err) { showToast('Error: ' + err.message, 5000) }
    setAccounts(prev => prev.map(a => a.email===email ? {...a,scanning:false} : a))
  }

  async function scanAll() { for (const a of accounts) await scanAccount(a.email) }
  function removeAccount(email) { setAccounts(p=>p.filter(a=>a.email!==email)); setApplications(p=>p.filter(a=>a.accountEmail!==email)); showToast('Removed '+email) }
  function removeApp(id) { setApplications(p=>p.filter(a=>a.id!==id)) }
  function updateStatus(id, status) { setApplications(p=>p.map(a=>a.id===id?{...a,status}:a)) }

  function exportCSV() {
    if (!applications.length) return showToast('Nothing to export')
    const rows = [['Company','Role','Status','Date','Link','Account'], ...applications.map(a=>[a.company,a.role,a.status,a.date,a.link||'',a.accountEmail||''])]
    const csv = rows.map(r=>r.map(v=>'"'+v+'"').join(',')).join('\n')
    const el = document.createElement('a')
    el.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}))
    el.download = 'internship-tracker.csv'; el.click()
    showToast('Exported!')
  }

  const filtered = applications
    .filter(a => filter==='all' || a.status===filter)
    .filter(a => !search || a.company?.toLowerCase().includes(search.toLowerCase()) || a.role?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => sortBy==='date' ? new Date(b.date)-new Date(a.date) : sortBy==='company' ? a.company.localeCompare(b.company) : a.status.localeCompare(b.status))

  const stats = {
    total: applications.length,
    inProgress: applications.filter(a=>['Phone Screen','Interview','Final Round'].includes(a.status)).length,
    interviews: applications.filter(a=>['Interview','Final Round'].includes(a.status)).length,
    offers: applications.filter(a=>a.status==='Offer Received').length,
    rate: applications.length ? Math.round(applications.filter(a=>a.status!=='Applied').length/applications.length*100) : 0,
  }

  const fmt = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : ''

  return (
    <>
      <Head><title>InternTrack</title></Head>
      <div className="content min-h-screen">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8 pb-6" style={{borderBottom:'1px solid #252d45'}}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{background:'linear-gradient(135deg,#5b8ef0,#7fd8be)'}}>🎯</div>
              <div>
                <div className="text-xl font-black">InternTrack</div>
                <div className="mono text-xs" style={{color:'#7a85a3'}}>Gmail-powered · multi-account</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={exportCSV} className="mono text-xs px-3 py-2 rounded-lg" style={{background:'transparent',border:'1px solid #252d45',color:'#7a85a3',cursor:'pointer'}}>⬇ Export CSV</button>
              <button onClick={scanAll} disabled={!accounts.length} className="px-4 py-2 rounded-lg font-bold text-sm text-white" style={{background:'linear-gradient(135deg,#5b8ef0,#4a7de0)',border:'none',cursor:accounts.length?'pointer':'not-allowed',opacity:accounts.length?1:0.5}}>⚡ Scan All Inboxes</button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3 mb-6">
            <StatCard label="Total" value={stats.total} color="#5b8ef0" sub="applications" />
            <StatCard label="In Progress" value={stats.inProgress} color="#f0c96b" sub="active" />
            <StatCard label="Interviews" value={stats.interviews} color="#f0a85b" sub="scheduled" />
            <StatCard label="Offers" value={stats.offers} color="#7fd8be" sub="received" />
            <StatCard label="Response Rate" value={stats.rate+'%'} color="#b4a0e6" sub="of applied" />
          </div>

          <div className="grid gap-5" style={{gridTemplateColumns:'1fr 300px'}}>
            <div>
              <div className="flex gap-3 mb-4">
                <input type="text" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} className="mono text-xs px-3 py-2 rounded-lg flex-1" style={{background:'#161c2e',border:'1px solid #252d45',color:'#e8eaf6',outline:'none'}} />
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="mono text-xs px-3 py-2 rounded-lg" style={{background:'#161c2e',border:'1px solid #252d45',color:'#7a85a3',cursor:'pointer',outline:'none'}}>
                  <option value="date">Sort: Date</option>
                  <option value="company">Sort: Company</option>
                  <option value="status">Sort: Status</option>
                </select>
              </div>
              <div className="flex gap-2 mb-4 flex-wrap">
                {['all','Applied','Phone Screen','Interview','Final Round','Offer Received','Rejected','Waitlisted'].map(f=>(
                  <button key={f} onClick={()=>setFilter(f)} className="mono text-xs px-3 py-1 rounded-full" style={{background:filter===f?'#5b8ef0':'#1a2035',border:'1px solid '+(filter===f?'#5b8ef0':'#252d45'),color:filter===f?'#fff':'#7a85a3',cursor:'pointer'}}>
                    {f==='all'?'All':f} {f!=='all'&&'('+applications.filter(a=>a.status===f).length+')'}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                {filtered.length===0 ? (
                  <div className="text-center py-16 rounded-xl" style={{background:'#161c2e',border:'1px dashed #252d45'}}>
                    <div className="text-4xl mb-3">📭</div>
                    <div className="font-bold text-lg mb-2">No applications yet</div>
                    <div className="mono text-sm" style={{color:'#7a85a3'}}>Add a Gmail account and scan</div>
                  </div>
                ) : filtered.map((app,i)=>(
                  <div key={app.id} className="rounded-xl p-4" style={{background:'#161c2e',border:'1px solid #252d45'}}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-base">{app.company}</span>
                          {app.accountEmail && <span className="mono text-xs px-2 py-0.5 rounded" style={{background:'#1a2035',color:'#7a85a3',border:'1px solid #252d45'}}>{app.accountEmail.split('@')[0]}</span>}
                        </div>
                        <div className="text-sm mb-2" style={{color:'#7a85a3'}}>{app.role}</div>
                        <div className="flex items-center gap-4">
                          <span className="mono text-xs" style={{color:'#7a85a3'}}>{fmt(app.date)}</span>
                          {app.link && <a href={app.link} target="_blank" rel="noopener noreferrer" className="mono text-xs" style={{color:'#5b8ef0'}}>↗ careers page</a>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={app.status} />
                        <div className="flex gap-1">
                          <select value={app.status} onChange={e=>updateStatus(app.id,e.target.value)} className="mono text-xs px-2 py-1 rounded" style={{background:'#1a2035',border:'1px solid #252d45',color:'#7a85a3',cursor:'pointer',outline:'none'}}>
                            {Object.keys(STATUS_CONFIG).map(s=><option key={s}>{s}</option>)}
                          </select>
                          <button onClick={()=>removeApp(app.id)} className="mono text-xs px-2 py-1 rounded" style={{background:'transparent',border:'1px solid #252d45',color:'#f07070',cursor:'pointer'}}>✕</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-xl p-4" style={{background:'#161c2e',border:'1px solid #252d45'}}>
                <div className="mono text-xs mb-3 flex items-center justify-between" style={{color:'#7a85a3',textTransform:'uppercase'}}>
                  <span>📧 Email Accounts</span>
                  <span style={{color:'#5b8ef0'}}>{accounts.length} connected</span>
                </div>
                {accounts.length===0 && <div className="mono text-xs text-center py-4" style={{color:'#7a85a3'}}>No accounts yet</div>}
                <div className="flex flex-col gap-2 mb-3">
                  {accounts.map(account=>(
                    <div key={account.email} className="rounded-lg p-3" style={{background:'#1a2035',border:'1px solid #252d45'}}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="mono text-xs" style={{color:'#e8eaf6',wordBreak:'break-all'}}>{account.email}</span>
                        <button onClick={()=>removeAccount(account.email)} style={{background:'none',border:'none',color:'#f07070',cursor:'pointer',marginLeft:8}}>✕</button>
                      </div>
                      <button onClick={()=>scanAccount(account.email)} disabled={account.scanning} className="w-full mono text-xs py-1.5 rounded-lg" style={{background:'rgba(91,142,240,0.1)',border:'1px solid #5b8ef0',color:'#5b8ef0',cursor:account.scanning?'not-allowed':'pointer'}}>
                        {account.scanning ? '⟳ Scanning...' : '⚡ Scan Inbox'}
                      </button>
                      <div className="mono text-xs mt-1" style={{color:'#7a85a3'}}>{applications.filter(a=>a.accountEmail===account.email).length} apps found</div>
                    </div>
                  ))}
                </div>
                <a href="/api/auth/google-url" className="block w-full py-2.5 rounded-lg font-bold text-sm text-center" style={{background:'linear-gradient(135deg,#7fd8be22,#5b8ef022)',border:'1px solid #7fd8be',color:'#7fd8be',textDecoration:'none'}}>
                  + Add Gmail Account
                </a>
              </div>

              {accounts.length>0 && (
                <div className="rounded-xl p-4" style={{background:'#161c2e',border:'1px solid #252d45'}}>
                  <div className="mono text-xs mb-3" style={{color:'#7a85a3',textTransform:'uppercase'}}>📊 By Account</div>
                  {accounts.map(account=>(
                    <div key={account.email} className="mb-3 pb-3" style={{borderBottom:'1px solid #252d45'}}>
                      <div className="mono text-xs mb-1" style={{color:'#e8eaf6',wordBreak:'break-all'}}>{account.email}</div>
                      <span className="mono text-xs" style={{color:'#5b8ef0'}}>{applications.filter(a=>a.accountEmail===account.email).length} apps</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl p-4" style={{background:'#161c2e',border:'1px solid #252d45'}}>
                <div className="mono text-xs mb-3" style={{color:'#7a85a3',textTransform:'uppercase'}}>💡 Tips</div>
                {['Scan weekly for updates','Fix status with dropdown','Add personal + school email','Export CSV to backup'].map((tip,i)=>(
                  <div key={i} className="mono text-xs mb-2 pl-3" style={{color:'#7a85a3',borderLeft:'2px solid #252d45'}}>{tip}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {toast && <div className="fixed bottom-6 right-6 mono text-sm px-4 py-3 rounded-xl z-50" style={{background:'#161c2e',border:'1px solid #7fd8be',color:'#7fd8be',boxShadow:'0 8px 32px rgba(0,0,0,0.4)'}}>{toast}</div>}
    </>
  )
}
