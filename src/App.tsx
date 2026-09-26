import { useCallback, useEffect, useState } from 'react'
import './App.css'

import type { SessionUser, Task, DriverOption, Division, DriverLocation, Notification, View, TaskDraft } from './types'
import { request, roleName } from './lib/api'
import { useGpsTracking, useWebSocket } from './lib/hooks'

import Login from './components/Login'
import Shell from './components/Shell'
import { Logo } from './components/ui'
import Detail from './pages/Detail'
import { StaffDashboard, DriverDashboard, AdminOverview, CreateTask } from './pages/Dashboard'
import Activity from './pages/Activity'
import History from './pages/History'
import Report from './pages/Report'
import DriverReport from './pages/DriverReport'
import Admin from './pages/Admin'
import GuestTask from './pages/GuestTask'

const VALID_VIEWS: View[] = ['dashboard', 'create', 'activity', 'history', 'report', 'admin']

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const role = user ? roleName(user.role) : null

  const [view, setView] = useState<View>(() => {
    const hash = window.location.hash.replace('#/', '')
    return VALID_VIEWS.includes(hash as View) ? hash as View : 'dashboard'
  })
  const [returnView, setReturnView] = useState<View>('dashboard')
  const [tasks, setTasks] = useState<Task[]>([])
  const [activityTasks, setActivityTasks] = useState<Task[]>([])
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [divisions, setDivisions] = useState<Division[]>([])
  const [driverLocations, setDriverLocations] = useState<DriverLocation[]>([])
  const [selected, setSelected] = useState<Task | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [toast, setToast] = useState('')
  const [loading, setLoading] = useState(true)
  const [fatal, setFatal] = useState('')

  const notify = (s: string) => { setToast(s); setTimeout(() => setToast(''), 2400) }
  const unread = notifications.filter(n => !n.read_at).length

  const loadAll = useCallback(async (u: SessionUser) => {
    const sa = u.role === 'STAFF' || u.role === 'ADMIN'
    const [t, d, n, act, div] = await Promise.all([
      request<{ tasks: Task[] }>('/tasks'),
      sa ? request<{ drivers: DriverOption[] }>('/drivers') : Promise.resolve({ drivers: [] }),
      request<{ notifications: Notification[] }>('/notifications'),
      sa ? request<{ tasks: Task[]; driverLocations: DriverLocation[] }>('/activity') : Promise.resolve({ tasks: [], driverLocations: [] }),
      sa ? request<{ divisions: Division[] }>('/admin/divisions') : Promise.resolve({ divisions: [] }),
    ])
    setTasks(t.tasks); setDrivers(d.drivers); setNotifications(n.notifications); setDriverLocations(act.driverLocations); setDivisions(div.divisions)
    setActivityTasks(act.tasks || [])
  }, [])

  const trackingActive = user?.role === 'DRIVER' && tasks.some(task => task.assigneeId === user.id && task.status === 'IN_PROGRESS')
  const gpsStatus = useGpsTracking(trackingActive)

  useWebSocket(!!user, (event, data) => {
    if (event === 'task_updated') {
      const updated = (data as { task: Task }).task
      setTasks(ts => ts.some(t => t.id === updated.id) ? ts.map(t => t.id === updated.id ? updated : t) : [updated, ...ts])
      setActivityTasks(ts => ts.some(t => t.id === updated.id) ? ts.map(t => t.id === updated.id ? updated : t) : [updated, ...ts])
      if (updated.status !== 'IN_PROGRESS') setDriverLocations(locations => locations.map(location => location.taskId === updated.id ? { ...location, taskId: null } : location))
      if (selected?.id === updated.id) setSelected(updated)
    }
    if (event === 'notification') { const n = data as Notification; setNotifications(ns => [n, ...ns]); notify(n.message) }
    if (event === 'drivers_updated') { if (user) loadAll(user) }
    if (event === 'driver_location') {
      const dl = data as DriverLocation
      setDriverLocations(locs => { const i = locs.findIndex(l => l.driverId === dl.driverId); if (i >= 0) { const n = [...locs]; n[i] = dl; return n }; return [...locs, dl] })
    }
  })

  useEffect(() => {
    request<{ user: SessionUser }>('/me').then(async ({ user }) => { setUser(user); await loadAll(user) }).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [loadAll])

  useEffect(() => {
    const timer = window.setInterval(() => setDriverLocations(locations => locations.filter(location => Date.now() - location.updatedAt < 120_000)), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const fn = () => { const h = window.location.hash.replace('#/', ''); if (VALID_VIEWS.includes(h as View)) { setSelected(null); setView(h as View) } }
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])

  const navigate = (v: View) => { setSelected(null); setView(v); window.location.hash = v === 'dashboard' ? '/' : '/' + v }

  const login = async (u: SessionUser) => {
    setUser(u); setLoading(true)
    try { await loadAll(u); window.history.replaceState(null, '', '/'); navigate('dashboard') }
    catch (e) { setFatal(e instanceof Error ? e.message : 'Gagal memuat data') }
    finally { setLoading(false) }
  }

  const logout = async () => {
    try { await request('/auth/logout', { method: 'POST' }) }
    finally { setUser(null); setTasks([]); window.location.href = '/' }
  }

  const open = (t: Task) => { setReturnView(view); setSelected(t); setView('detail') }

  const update = async (id: number, patch: Partial<Task>) => {
    const action = patch.status === 'IN_PROGRESS' ? 'start' : patch.status === 'COMPLETED' ? 'complete' : 'cancel'
    const body = action === 'complete' ? { note: patch.note, photos: patch.photos, latitude: patch.completionLatitude, longitude: patch.completionLongitude }
      : action === 'cancel' ? { reason: patch.cancelReason } : {}
    const { task } = await request<{ task: Task }>(`/tasks/${id}/${action}`, { method: 'PATCH', body: JSON.stringify(body) })
    setTasks(ts => ts.map(t => t.id === id ? task : t)); setSelected(task)
    if (action === 'complete') setDriverLocations(locations => locations.map(location => location.taskId === id ? { ...location, taskId: null } : location))
    notify(action === 'complete' ? 'Tugas selesai.' : action === 'cancel' ? 'Tugas dibatalkan.' : 'Timer dimulai.')
  }

  const create = async (data: TaskDraft & { assigneeId: number }) => {
    const { task } = await request<{ task: Task }>('/tasks', { method: 'POST', body: JSON.stringify({ title: data.title, description: data.description, priority: data.priority, assigneeId: data.assigneeId, locationName: data.destination, address: data.address, referencePhoto: data.referencePhoto, latitude: data.latitude, longitude: data.longitude, scheduledAt: data.scheduledAt, divisionId: divisions.find(d => d.name === data.division)?.id }) })
    setTasks(t => [task, ...t]); navigate('dashboard'); notify('Tugas baru dibuat.')
  }

  const markRead = async () => { await request('/notifications/read', { method: 'POST' }); setNotifications(ns => ns.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))) }
  const reloadDivisions = useCallback(() => { request<{ divisions: Division[] }>('/admin/divisions').then(r => setDivisions(r.divisions)).catch(() => {}) }, [])

  if (loading) return (
    <main className="loading app-loader" aria-live="polite" aria-busy="true">
      <div className="app-loader-content">
        <div className="app-loader-logo">
          <Logo variant="icon" />
          <span />
        </div>
        <small>Menyiapkan ruang kerja…</small>
      </div>
    </main>
  )
  if (window.location.pathname === '/tugasgo') return <GuestTask />
  if (!user || !role) return <Login onLogin={(u) => login(u)} />
  if (fatal) return <main className="loading"><div><b>Gagal memuat data</b><p>{fatal}</p><button className="primary" onClick={() => location.reload()}>Coba lagi</button></div></main>

  let screen: React.ReactNode
  if (view === 'detail' && selected) screen = <Detail task={selected} role={role} user={user} onBack={() => navigate(returnView)} onUpdate={update} />
  else if (view === 'activity') screen = <Activity tasks={activityTasks} role={role} driverLocations={driverLocations} onOpen={open} />
  else if (view === 'history') screen = <History user={user} tasks={tasks} onOpen={open} role={role} />
  else if (view === 'report') screen = role === 'Driver' ? <DriverReport user={user} tasks={tasks} /> : <Report user={user} tasks={tasks} />
  else if (view === 'admin') screen = <Admin divisions={divisions} onReload={reloadDivisions} onOpenTasks={() => navigate('history')} />
  else if (role === 'Staff' && view === 'create') screen = <CreateTask user={user} onCreate={create} onCancel={() => navigate('dashboard')} drivers={drivers} divisions={divisions} />
  else if (role === 'Staff') screen = <StaffDashboard user={user} tasks={activityTasks.length ? activityTasks : tasks} onOpen={open} setView={navigate} driverLocations={driverLocations} />
  else if (role === 'Driver') screen = <DriverDashboard user={user} tasks={tasks} onOpen={open} />
  else screen = <AdminOverview tasks={tasks} driverLocations={driverLocations} />

  const openTaskById = (taskId: number) => {
    const target = tasks.find(t => t.id === taskId)
    if (target) {
      open(target)
    } else {
      request<{ tasks: Task[] }>('/tasks').then(({ tasks: fresh }) => {
        setTasks(fresh)
        const found = fresh.find(t => t.id === taskId)
        if (found) open(found)
      }).catch(() => {})
    }
  }

  return (
    <Shell
      user={user}
      role={role}
      view={view}
      setView={navigate}
      logout={logout}
      notifCount={unread}
      notifications={notifications}
      onMarkRead={markRead}
      onOpenTask={openTaskById}
      gpsStatus={user.role === 'DRIVER' && trackingActive ? gpsStatus : undefined}
    >
      {screen}
      {toast && <div className="toast">✓ {toast}</div>}
    </Shell>
  )
}
