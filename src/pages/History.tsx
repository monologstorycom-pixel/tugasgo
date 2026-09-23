import { useState } from 'react'
import type { SessionUser, Task, Role } from '../types'
import TaskRow from '../components/TaskRow'

export default function History({ user, tasks, onOpen, role }: { user: SessionUser; tasks: Task[]; onOpen: (t: Task) => void; role: Role }) {
  const [status, setStatus] = useState('ALL')
  const [priority, setPriority] = useState('ALL')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const scoped = role === 'Staff' ? tasks.filter(t => t.creatorId === user.id)
    : role === 'Driver' ? tasks.filter(t => t.assigneeId === user.id)
    : tasks

  const filtered = scoped.filter(t => {
    if (status !== 'ALL' && t.status !== status) return false
    if (priority !== 'ALL' && t.priority !== priority) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.destination.toLowerCase().includes(search.toLowerCase())) return false
    if (from && t.created < new Date(from).getTime()) return false
    if (to && t.created > new Date(to + 'T23:59:59').getTime()) return false
    return true
  })

  const reset = () => { setSearch(''); setStatus('ALL'); setPriority('ALL'); setFrom(''); setTo('') }
  const hasFilter = search || status !== 'ALL' || priority !== 'ALL' || from || to

  return (
    <main className="page">
      <div className="page-head"><div><h1>Riwayat</h1></div></div>
      <div className="filters">
        <input className="search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari judul atau lokasi…" />
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="ALL">Semua status</option>
          <option value="WAITING">Waiting</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)}>
          <option value="ALL">Semua prioritas</option>
          <option value="NORMAL">Normal</option>
          <option value="URGENT">Urgent</option>
        </select>
        <input type="date" className="date-input" value={from} onChange={e => setFrom(e.target.value)} />
        <input type="date" className="date-input" value={to} onChange={e => setTo(e.target.value)} />
        {hasFilter && <button className="secondary" style={{ padding: '8px 12px', fontSize: 12 }} onClick={reset}>Reset</button>}
      </div>
      <section className="panel">
        <div className="section-title"><div><h2>Tugas</h2><p>{filtered.length} dari {scoped.length} hasil</p></div></div>
        <div className="task-list">
          {filtered.length ? filtered.map(t => <TaskRow key={t.id} task={t} onOpen={onOpen} />) : (
            <div className="empty"><b>Tidak ada hasil</b></div>
          )}
        </div>
      </section>
    </main>
  )
}
