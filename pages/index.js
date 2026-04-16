import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

const SC = {
  'Applied':        { b: 'badge-applied',    d: 'var(--accent)' },
  'Phone Screen':   { b: 'badge-screen',     d: 'var(--yellow)' },
  'Interview':      { b: 'badge-interview',  d: 'var(--orange)' },
  'Final Round':    { b: 'badge-interview',  d: 'var(--orange)' },
  'Offer Received': { b: 'badge-offer',      d: 'var(--green)'  },
  'Rejected':       { b: 'badge-rejected',   d: 'var(--red)'    },
  'Waitlisted':     { b: 'badge-waitlisted', d: 'var(--purple)' },
}

function Badge({ status }) {
  const c = SC[status] || SC['Applied']
  return <span className={'badge ' + c.b}><span className='dot' style={{background:c.d}}/>{status}</span>
}

export default function Home() {
  const router = useRouter()
  const [theme, setTheme] = useState('light')
  const [accounts, setAccounts] = useState([])
  const [apps, setApps] = useState([])
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('date')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    const t = localStorage.getItem('it_theme') || 'light'
    setTheme(t); document.documentElement.setAttribute('data-theme', t)
    const a = localStorage.getItem('it_apps'); if(a) setApps(JSON.parse(a))
    const b = localStorage.getItem('it_accounts'); if(b) setAccounts(JSON.parse(b))
  }, [])

  useEffect(() => { document.documentElement.setAttribute('data-theme',theme); localStorage.setItem('it_theme',theme) }, [theme])
  useEffect(() => { localStorage.setItem('it_apps', JSON.stringify(apps)) }, [apps])
  useEffect(() => { localStorage.setItem('it_accounts', JSON.stringify(accounts.map(a=>({...a,scanning:false})))) }, [accounts])

  useEffect(() => {
    try {
      const { email, accessToken } = JSON.parse(decodeURIComponent(router.query.newAccount))
      setAccounts(prev => {
        const exists = prev.find(a => a.email===email)
        if (exists) return prev.map(a => a.email===email ? {...a,accessToken} : a)
        showToast('Added ' + email)
        return [...prev, {email, accessToken, scanning:false}]
      })
      router.replace('/', undefined, {shallow:true})
    } catch(e) {}
  }, [router.query.newAccount])

  function showToast(msg, d=3000) { setToast(msg); clearTimeout(timer.current); timer.current=setTimeout(()=>setToast(null),d) }

  async function scanAccount(email) {
    const account = accounts.find(a=>a.email===email);
    if(!account) return;
    setAccounts(prev=>prev.map(a=>a.email===email?{...a,scanning:true}:a))
    try {
      const res = await fetch('/api/scan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:account.accessToken,accountEmail:email})})
      const {applications=[]} = await res.json()
      setApps(prev => {
        const updated=[...prev]
        for(const app of applications) {
          const idx=updated.findIndex(a=>a.company.toLowerCase()===app.company.toLowerCase()&&a.role.toLowerCase()===app.role.toLowerCase()&&a.accountEmail===app.accountEmail)
          if(idx>=0) updated[idx]={...updated[idx],...app,id:updated[idx].id}
          else updated.push({...app,id:Date.now()+Math.random()})
        }
        return updated
      })
      showToast('Found '+applications.length+' apps')
    } catch(e) { showToast('Error: '+e.message,5000) }
    setAccounts(prev=>prev.map(a=>a.email===email?{...a,scanning:false}:a))
  }

  const fmt = d=>d?new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):''
  const stats={total:apps.length,active:apps.filter(a=>['Phone Screen','Interview','Final Round'].includes(a.status)).length,offers:apps.filter(a=>a.status==='Offer Received').length,rate:apps.length?Math.round(apps.filter(a=>a.status!=='Applied').length/apps.length*100):0}

  return (<>
    <Head><title> InternTrack</title></Head>
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      <div style={{borderBottom:'1px solid var(--border)',background:'var(--surface)',position:'sticky',top:0,zIndex:50}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'0 24px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            
            <span style={{fontWeight:600,fontSize:15}}>InternTrack</span>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={()=>setTheme(t=>t==='light'?'dark':'light')} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,padding:'6px 10px',cursor:'pointer',fontSize:14}}>{theme==='light'?'🌙':'☀️'}</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'32px 24px',display:'grid',gridTemplateColumns:'1fr 280px',gap:24,alignItems:'start'}}>
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
            {[['Total',stats.total,'applications','var(--text)'],['Active',stats.active,'in progress','var(--orange)'],['Offers',stats.offers,'received','var(--green)'],['Response',stats.rate+'%','rate','var(--accent)']].map(([l,v,s,c])=>(
              <div key={l} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'16px 20px'}}>
                <div style={{fontSize:11,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>{l}</div>
                <div style={{fontSize:28,fontWeight:600,color:c,lineHeight:1,marginBottom:4}}>{v}</div>
                <div style={{fontSize:12,color:'var(--text3)'}}>{s}</div>
              </div>
            ))}
          </div>

          <div style={{display:'flex',gap:8,marginBottom:14}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder='Search...' style={{flex:1,padding:'8px 12px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',fontSize:13,outline:'none'}}/>
            <select value={sort} onChange={e=>setSort(e.target.value)} style={{padding:'8px 10px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:6,color:'var(--text)',fontSize:13,outline:'none',cursor:'pointer'}}>
              <option value='date'>Date</option><option value='company'>Company</option><option value='status'>Status</option>
            </select>
          </div>

          <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
            {['all','Applied','Phone Screen','Interview','Final Round','Offer Received','Rejected','Waitlisted'].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{fontSize:11,padding:'4px 10px',borderRadius:20,cursor:'pointer',border:'1px solid',background:filter===f?'var(--text)':'transparent',borderColor:filter===f?'var(--text)':'var(--border)',color:filter===f?'var(--bg)':'var(--text2)'}}>
                {f==='all'?'All':f} · {f==='all'?apps.length:apps.filter(a=>a.status===f).length}
              </button>
            ))}
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {apps.length===0?(<div style={{textAlign:'center',padding:'64px 24px',border:'1px dashed var(--border)',borderRadius:12}}><div style={{fontSize:32,marginBottom:12}}>📭</div><div style={{fontWeight:500,marginBottom:6}}>No applications yet</div><div style={{color:'var(--text3)',fontSize:13}}>Add a Gmail account and scan</div></div>)
            :apps.map(app=>(<div key={app.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px'}} onMouseEnter={e=>e.currentTarget.style.borderColor='var(--border2)'} onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14,marginBottom:3}}>{app.company} {app.accountEmail&&<span style={{fontSize:10,color:'var(--text3)',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:4,padding:'1px 5px',marginLeft:6}}>{app.accountEmail.split('@')[0]}</span>}</div>
                  <div style={{color:'var(--text2)',fontSize:13,marginBottom:8}}>{app.role}</div>
                  <div style={{display:'flex',gap:12,alignItems:'center'}}>
                    <span style={{fontSize:11,color:'var(--text3)'}}>{fmt(app.date)}</span>
                    {app.link&&<a href={app.link} target='_blank' rel='noopener noreferrer' style={{fontSize:11,color:'var(--accent)',textDecoration:'none'}}>↗ careers</a>}
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8}}>
                  <Badge status={app.status}/>
                  <div style={{display:'flex',gap:5}}>
                    <select value={app.status} onChange={e=>setApps(p=>p.map(a=>a.id===app.id?{...a,status:e.target.value}:a))} style={{fontSize:11,padding:'4px 6px',background:'var(--bg2)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:5,cursor:'pointer',outline:'none'}}>
                      {Object.keys(SC).map(s=><option key={s}>{s}</option>)}
                    </select>
                    <button onClick={()=>setApps(p=>p.filter(a=>a.id!==app.id))} style={{fontSize:11,padding:'4px 8px',background:'transparent',border:'1px solid var(--border)',color:'var(--text3)',borderRadius:5,cursor:'pointer'}}>✕</button>
                  </div>
                </div>
              </div>
            </div>))}
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:14,position:'sticky',top:72}}>
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:16}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
              <span style={{fontSize:12,fontWeight:600,color:'var(--text2)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Accounts</span>
              <span style={{fontSize:11,color:'var(--accent)'}}>{accounts.length} connected</span>
            </div>
            {accounts.length===0&&<p style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>Connect Gmail to start scanning.</p>}
            {accounts.map(a=>(<div key={a.email} style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px',marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:12,fontWeight:500,wordBreak:'break-all'}}>{a.email}</span>
                <button onClick={()=>{setAccounts(p=>p.filter(x=>x.email!==a.email));setApps(p=>p.filter(x=>x.accountEmail!==a.email))}} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',marginLeft:6}}>✕</button>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:11,color:'var(--text3)'}}>{apps.filter(x=>x.accountEmail===a.email).length} apps</span>
                <button onClick={()=>scanAccount(a.email)} disabled={a.scanning} style={{fontSize:11,padding:'4px 10px',background:'var(--accent-bg)',border:'1px solid var(--accent)',color:'var(--accent)',borderRadius:5,cursor:'pointer'}}>{a.scanning?'⟳ Scanning':'⚡ Scan'}</button>
              </div>
            </div>))}
            <a href='/api/auth/google-url' style={{display:'flex',alignItems:'center',justifyContent:'center',width:'100%',padding:'8px 12px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:7,color:'var(--text2)',fontSize:13,fontWeight:500,textDecoration:'none'}}>+ Add Gmail Account</a>
          </div>

          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:16}}>
            <div style={{fontSize:12,fontWeight:600,color:'var(--text2)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:12}}>Tips</div>
            {['Scan weekly for updates','Fix status with dropdown','Add personal + school email','Export CSV to backup'].map((t,i)=>(
              <div key={i} style={{fontSize:12,color:'var(--text3)',marginBottom:8,paddingLeft:10,borderLeft:'2px solid var(--border)',lineHeight:1.5}}>{t}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
    {toast&&<div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',background:'var(--text)',color:'var(--bg)',fontSize:13,fontWeight:500,padding:'10px 18px',borderRadius:8,whiteSpace:'nowrap',zIndex:100}}>{toast}</div>}
  </>)
}