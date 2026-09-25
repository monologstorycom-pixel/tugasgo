import { useState } from 'react'
import type { SessionUser } from '../types'
import { request } from '../lib/api'
import { Logo } from './ui'
import { usePwaInstall } from '../lib/pwa'

export default function Login({ onLogin }: { onLogin: (u: SessionUser, token: string) => void }) {
  const { isInstallable, install } = usePwaInstall()
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
      <section className="login-mobile">
        <div className="login-mobile-top">
          <Logo variant="icon" />
          <small>by Auri IT Dept</small>
        </div>
        <div className="login-mobile-hero">
          <p className="eyebrow">OPERASIONAL HARIAN</p>
          <h1>Driver Task Management System</h1>
          <p>Kelola tugas, driver, bukti kerja, dan laporan harian.</p>
        </div>
        <form className="login-mobile-card form" onSubmit={e => { e.preventDefault(); doLogin(username, password) }}>
          <h2>Masuk akun</h2>
          <label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required autoFocus /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary full" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
          {isInstallable && <button type="button" className="secondary full" onClick={install}>Pasang Aplikasi TugasGo</button>}
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
      <section className="login-brand">
        <Logo variant="lockup" />
        <div className="login-copy">
          <p className="eyebrow">OPERASIONAL HARIAN</p>
          <h1>Driver Task Management System</h1>
          <small className="login-credit">by Auri IT Dept</small>
        </div>
      </section>
      <section className="login-panel">
        <form className="login-box form" onSubmit={e => { e.preventDefault(); doLogin(username, password) }}>
          <div className="login-box-head">
            <Logo variant="icon" />
            <div>
              <h2>Masuk akun</h2>
              <p className="muted">Gunakan akun operasional Anda.</p>
            </div>
          </div>
          <label>Username<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required autoFocus /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary full" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
          {isInstallable && (
            <button type="button" className="secondary full" style={{ marginTop: 10 }} onClick={install}>
              📲 Pasang Aplikasi TugasGo
            </button>
          )}
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
