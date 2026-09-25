import { useEffect, useRef, useState } from 'react'
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

function notifIcon(type: string) {
  switch (type) {
    case 'TASK_COMPLETED':
      return {
        cls: 'icon-done',
        svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
      }
    case 'TASK_CANCELLED':
      return {
        cls: 'icon-cancel',
        svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      }
    case 'TASK_STARTED':
    case 'TASK_PROGRESS':
      return {
        cls: 'icon-progress',
        svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3" /></svg>
      }
    default:
      return {
        cls: 'icon-create',
        svg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="15" y2="15" /></svg>
      }
  }
}

export default function Shell({ user, role, view, setView, logout, notifCount, notifications, onMarkRead, onOpenTask, gpsStatus, children }: {
  user: SessionUser; role: Role; view: View; setView: (v: View) => void
  logout: () => void; notifCount: number; notifications: Notification[]; onMarkRead: () => void
  onOpenTask?: (taskId: number) => void; gpsStatus?: GpsStatus; children: React.ReactNode
}) {
  const [notifOpen, setNotifOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const notifRef = useRef<HTMLDivElement>(null)
  const { isInstallable, install } = usePwaInstall()
  const items = NAV[role]
  const mobileItems = role === 'Admin' ? items.filter(([v]) => v !== 'history') : items

  const toggleNotif = () => {
    setNotifOpen(v => !v)
  }

  useEffect(() => {
    if (!notifOpen) return
    const onDocClick = (e: MouseEvent | TouchEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('touchstart', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('touchstart', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [notifOpen])

  const handleItemClick = (n: Notification) => {
    if (!n.read_at) onMarkRead()
    if (n.taskId && onOpenTask) {
      onOpenTask(n.taskId)
      setNotifOpen(false)
    }
  }

  const unreadItems = notifications.filter(n => !n.read_at)
  const displayedItems = (tab === 'unread' ? unreadItems : notifications).slice(0, 15)

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
            <div className="notif-wrap" ref={notifRef}>
              <button
                className={`notif-bell ${notifOpen ? 'is-open' : ''} ${notifCount > 0 ? 'has-unread' : ''}`}
                onClick={toggleNotif}
                title="Notifikasi"
                aria-label={`Notifikasi (${notifCount} baru)`}
                aria-expanded={notifOpen}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {notifCount > 0 && <span className="notif-badge">{notifCount > 99 ? '99+' : notifCount}</span>}
              </button>
              {notifOpen && (
                <>
                  <div className="notif-backdrop" onClick={() => setNotifOpen(false)} aria-hidden="true" />
                  <div className="notif-panel" role="dialog" aria-label="Daftar Notifikasi">
                    <div className="notif-panel-head">
                      <div className="notif-panel-title">
                        <b>Notifikasi</b>
                        {notifCount > 0 && <span className="notif-pill">{notifCount} baru</span>}
                      </div>
                      <div className="notif-panel-actions">
                        {notifCount > 0 && (
                          <button type="button" className="notif-mark-btn" onClick={onMarkRead} title="Tandai semua telah dibaca">
                            Tandai dibaca
                          </button>
                        )}
                        <button type="button" className="notif-close-btn" onClick={() => setNotifOpen(false)} aria-label="Tutup">✕</button>
                      </div>
                    </div>

                    <div className="notif-tabs">
                      <button type="button" className={`notif-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
                        Semua ({notifications.length})
                      </button>
                      <button type="button" className={`notif-tab ${tab === 'unread' ? 'active' : ''}`} onClick={() => setTab('unread')}>
                        Belum dibaca ({unreadItems.length})
                      </button>
                    </div>

                    <div className="notif-list">
                      {displayedItems.length === 0 ? (
                        <div className="notif-empty">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="notif-empty-icon">
                            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                          <p>{tab === 'unread' ? 'Semua notifikasi sudah dibaca' : 'Belum ada notifikasi'}</p>
                        </div>
                      ) : (
                        displayedItems.map(n => {
                          const iconData = notifIcon(n.type)
                          const isUnread = !n.read_at
                          return (
                            <button
                              key={n.id}
                              type="button"
                              className={`notif-item ${isUnread ? 'unread' : ''} ${n.taskId ? 'clickable' : ''}`}
                              onClick={() => handleItemClick(n)}
                            >
                              <div className={`notif-item-icon ${iconData.cls}`}>
                                {iconData.svg}
                              </div>
                              <div className="notif-item-body">
                                <span className="notif-item-msg">{n.message}</span>
                                <div className="notif-item-meta">
                                  <small>{dateTime(new Date(n.created_at).getTime())}</small>
                                  {n.taskId ? <span className="notif-item-link">Buka tugas ›</span> : null}
                                </div>
                              </div>
                              {isUnread && <span className="notif-dot" title="Belum dibaca" />}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                </>
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

