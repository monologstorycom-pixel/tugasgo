import { useState } from 'react'
import type { SessionUser } from '../types'
import { request } from '../lib/api'
import { Logo } from './ui'

export default function Login({ onLogin }: { onLogin: (u: SessionUser, token: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const doLogin = async (u: string, p: string) => {
    setBusy(true); setError('')
    try {
      const { user } = await request<{ user: SessionUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) })
      onLogin(user, u)
    } catch (e) { setError(e instanceof Error ? e.message : 'Login gagal') }
    finally { setBusy(false) }
  }

  return (
    <main className="login">
      <section className="login-brand">
        <Logo variant="lockup" />
        <div>
          <p className="eyebrow">OPERASIONAL HARIAN</p>
          <h1>Driver Task Management System</h1>
          <small>by Auri IT System</small>
        </div>
        <small>Sistem internal ASM</small>
      </section>
      <section className="login-panel">
        <form className="login-box form" onSubmit={e => { e.preventDefault(); doLogin(username, password) }}>
          <p className="eyebrow">MASUK TUGASGO</p>
          <h2>Masuk akun</h2>
          <p className="muted">Gunakan akun operasional Anda.</p>
          <label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required autoFocus /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary full" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
          {import.meta.env.DEV && (
            <div className="dev-logins">
              <p className="eyebrow">DEV — QUICK LOGIN</p>
              <div className="dev-login-btns">
                 <button type="button" onClick={() => doLogin('admin', 'Admin123!@#$%')} disabled={busy}>Admin</button>
                 <button type="button" onClick={() => doLogin('risen', 'Driver123!@#$%')} disabled={busy}>Driver</button>
              </div>
            </div>
          )}
        </form>
      </section>
    </main>
  )
}
