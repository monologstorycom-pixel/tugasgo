import { useState } from 'react'
import type { Role, View, SessionUser, Notification } from '../types'
import { Logo, NavIcon } from './ui'
import { dateTime } from '../lib/api'
import type { GpsStatus } from '../lib/hooks'
import { usePwaInstall } from '../lib/pwa'

const NAV: Record<Role, [View, string, string][]> = {
  Staff: [
    ['dashboard', 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10', 'Ringkasan'],
    ['create', 'M12 4v16M4 12h16', 'Buat tugas'],
    ['activity', 'M3 17l4-8 4 4 4-6 4 6', 'Aktivitas'],
    ['history', 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'Riwayat'],
    ['report', 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h10M13 19V9a2 2 0 00-2-2H9m4 12v-4a2 2 0 012-2h2a2 2 0 012 2v4', 'Laporan'],
  ],
  Driver: [
    ['dashboard', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', 'Tugas saya'],
    ['report', 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h10M13 19V9a2 2 0 00-2-2H9m4 12v-4a2 2 0 012-2h2a2 2 0 012 2v4', 'Laporan saya'],
  ],
  Admin: [
    ['dashboard', 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z', 'Overview'],
    ['activity', 'M3 17l4-8 4 4 4-6 4 6', 'Aktivitas'],
    ['history', 'M4 6h16M4 10h16M4 14h16M4 18h16', 'Semua tugas'],
    ['report', 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h10M13 19V9a2 2 0 00-2-2H9m4 12v-4a2 2 0 012-2h2a2 2 0 012 2v4', 'Laporan'],
    ['admin', 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', 'Manajemen'],
  ],
}

export default function Shell({ user, role, view, setView, logout, notifCount, notifications, onMarkRead, gpsStatus, children }: {
  user: SessionUser; role: Role; view: View; setView: (v: View) => void
  logout: () => void; notifCount: number; notifications: Notification[]; onMarkRead: () => void; gpsStatus?: GpsStatus; children: React.ReactNode
}) {
  const [notifOpen, setNotifOpen] = useState(false)
  const { isInstallable, install } = usePwaInstall()
  const items = NAV[role]
  const mobileItems = role === 'Admin' ? items.filter(([v]) => v !== 'history') : items

  const toggleNotif = () => {
    if (!notifOpen && notifCount > 0) onMarkRead()
    setNotifOpen(v => !v)
  }

  return (
    <div className="shell">
      <aside>
        <Logo />
        <nav>
          {items.map(([v, iconPath, label]) => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
              <NavIcon path={iconPath} />{label}
            </button>
          ))}
        </nav>
        {isInstallable && (
          <div style={{ padding: '0 12px 12px' }}>
            <button type="button" className="pwa-install-aside-btn" onClick={install}>
              📲 Pasang Aplikasi
            </button>
          </div>
        )}
        <div className="profile">
          <span className="avatar">{user.name[0]}</span>
          <div><b>{user.name}</b><small>{role}</small></div>
          <button title="Keluar" onClick={logout}>↗</button>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div className="mobile-logo"><Logo variant="icon" /></div>
          <div className="header-right">
            {isInstallable && (
              <button type="button" className="pwa-install-header-btn" onClick={install} title="Pasang TugasGo">
                📲 Pasang App
              </button>
            )}
            {gpsStatus && <span className={`gps-status ${gpsStatus.state}`} role={gpsStatus.state === 'error' || gpsStatus.state === 'warning' ? 'alert' : 'status'}><i />{gpsStatus.message}</span>}
            <div className="notif-wrap">
              <button className="notif-bell" onClick={toggleNotif} title="Notifikasi">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
              </button>
              {notifOpen && (
                <div className="notif-panel">
                  <div className="notif-panel-head"><b>Notifikasi</b><button onClick={() => setNotifOpen(false)}>✕</button></div>
                  {notifications.length === 0
                    ? <div className="notif-empty">Tidak ada notifikasi</div>
                    : notifications.slice(0, 10).map(n => (
                      <div key={n.id} className={`notif-item${!n.read_at ? ' unread' : ''}`}>
                        <span>{n.message}</span>
                        <small>{dateTime(new Date(n.created_at).getTime())}</small>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
            <button className="mobile-exit" onClick={logout}>Keluar</button>
          </div>
        </header>
        {children}
      </div>
      <nav className="bottom-nav">
        {mobileItems.map(([v, iconPath, label]) => (
          <button key={v} className={view === v || (role === 'Admin' && view === 'history' && v === 'admin') ? 'active' : ''} onClick={() => setView(v)}>
            <NavIcon path={iconPath} size={20} />{label}
          </button>
        ))}
      </nav>
    </div>
  )
}
