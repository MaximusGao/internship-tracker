import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'

export default function AuthCallback() {
  const { data: session } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session?.accessToken && session?.user?.email) {
      // Read existing accounts from localStorage
      const existing = JSON.parse(localStorage.getItem('interntrack_accounts') || '[]')
      const email = session.user.email
      const token = session.accessToken

      const alreadyExists = existing.find(a => a.email === email)
      let updated
      if (alreadyExists) {
        updated = existing.map(a => a.email === email ? { ...a, accessToken: token } : a)
      } else {
        updated = [...existing, { email, accessToken: token, scanning: false }]
      }

      localStorage.setItem('interntrack_accounts', JSON.stringify(updated))
      // Redirect back to home
      router.push('/')
    }
  }, [session])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#0c0f1a', color: '#e8eaf6',
      fontFamily: 'sans-serif', flexDirection: 'column', gap: 16
    }}>
      <div style={{ fontSize: 32 }}>🔄</div>
      <div>Adding account...</div>
    </div>
  )
}
