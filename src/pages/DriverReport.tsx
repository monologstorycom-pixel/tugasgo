import { useState } from 'react'
import type { Task, SessionUser } from '../types'
import { API, dateTime, elapsed } from '../lib/api'

const humanDuration = (seconds: number | null | undefined): string => {
  if (!seconds || seconds <= 0) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d} hari ${h} jam ${m} menit`
  if (h > 0) return `${h} jam ${m} menit`
  return `${m} menit`
}

export default function DriverReport({ user, tasks }: { user: SessionUser; tasks: Task[] }) {
  const [filter, setFilter] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [exporting, setExporting] = useState(false)

  const myTasks = tasks.filter(t => {
    if (t.assigneeId !== user.id) return false
    if (filter !== 'ALL' && t.status !== filter) return false
    if (from && t.created < new Date(from).getTime()) return false
    if (to && t.created > new Date(to + 'T23:59:59').getTime()) return false
    return true
  }).sort((a, b) => b.created - a.created)

  const all = tasks.filter(t => t.assigneeId === user.id)
  const stats = {
    total: all.length,
    completed: all.filter(t => t.status === 'COMPLETED').length,
    cancelled: all.filter(t => t.status === 'CANCELLED').length,
    totalSec: all.reduce((s, t) => s + (t.durationSeconds || 0), 0),
  }
  const avgSec = stats.completed > 0 ? Math.round(stats.totalSec / stats.completed) : 0

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'ALL') params.set('status', filter)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`${API}/export/driver?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Export gagal')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const today = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `laporan-${user.name.toLowerCase().replace(/\s+/g, '-')}-${today}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Export gagal')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="page">
      <div className="page-head">
        <div><h1>Laporan saya</h1></div>
        <button className="primary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Menyiapkan…' : '↓ Export Excel'}
        </button>
      </div>

      {/* Stats ringkas */}
      <section className="stats" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <div><small>TOTAL</small><strong>{stats.total}</strong></div>
        <div><small>SELESAI</small><strong>{stats.completed}</strong></div>
        <div><small>DIBATALKAN</small><strong>{stats.cancelled}</strong></div>
        <div><small>TOTAL DURASI</small><strong style={{ fontSize: 16 }}>{humanDuration(stats.totalSec)}</strong></div>
      </section>
      {avgSec > 0 && (
        <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--muted)' }}>
          Rata-rata durasi per tugas: <b style={{ color: 'var(--ink)' }}>{humanDuration(avgSec)}</b>
        </div>
      )}

      {/* Filter */}
      <div className="filters" style={{ marginBottom: 0 }}>
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="ALL">Semua status</option>
          <option value="COMPLETED">Selesai</option>
          <option value="CANCELLED">Dibatalkan</option>
          <option value="IN_PROGRESS">Berjalan</option>
          <option value="WAITING">Waiting</option>
        </select>
        <input type="date" className="date-input" value={from} onChange={e => setFrom(e.target.value)} />
        <input type="date" className="date-input" value={to} onChange={e => setTo(e.target.value)} />
        {(filter !== 'ALL' || from || to) && (
          <button className="secondary" style={{ fontSize: 12, padding: '8px 12px' }}
            onClick={() => { setFilter('ALL'); setFrom(''); setTo('') }}>Reset</button>
        )}
      </div>

      {/* Tabel */}
      <section className="panel report-table" style={{ marginTop: 16 }}>
        <div className="section-title">
          <div><h2>Riwayat tugas</h2><p>{myTasks.length} tugas</p></div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Judul</th>
                <th>Tujuan</th>
                <th>Divisi</th>
                <th>Status</th>
                <th>Prioritas</th>
                <th>Dibuat</th>
                <th>Dimulai</th>
                <th>Selesai</th>
                <th>Durasi</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {myTasks.length ? myTasks.map(t => {
                const statusColor = t.status === 'COMPLETED' ? 'green' : t.status === 'CANCELLED' ? 'red' : t.status === 'IN_PROGRESS' ? 'blue' : 'gray'
                return (
                  <tr key={t.id}>
                    <td>
                      <b style={{ display: 'block', fontSize: 13 }}>{t.title}</b>
                      {t.referencePhoto && (t.referencePhoto.startsWith('http') || t.referencePhoto.startsWith('blob')) && (
                        <a href={t.referencePhoto} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--blue)' }}>Foto referensi ↗</a>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>{t.destination}<br /><span style={{ color: 'var(--muted)', fontSize: 11 }}>{t.address}</span></td>
                    <td style={{ fontSize: 12 }}>{t.division}</td>
                    <td>
                      <span className={`badge ${statusColor}`}>{t.status.replace('_', ' ')}</span>
                    </td>
                    <td>
                      <span className={`badge ${t.priority === 'URGENT' ? 'red' : 'gray'}`}>{t.priority}</span>
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{dateTime(t.created)}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{t.startedAt ? dateTime(t.startedAt) : '—'}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {t.completedAt ? dateTime(t.completedAt) : t.cancelledAt ? dateTime(t.cancelledAt) : '—'}
                    </td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {t.durationSeconds
                        ? humanDuration(t.durationSeconds)
                        : t.startedAt && t.status === 'IN_PROGRESS'
                          ? humanDuration(elapsed(t))
                          : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {t.note || t.cancelReason || '—'}
                      {t.photos?.length ? (
                        <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {t.photos.filter(p => p.startsWith('http') || p.startsWith('blob')).map((p, i) => (
                            <a key={i} href={p} target="_blank" rel="noreferrer"
                              style={{ fontSize: 10, color: 'var(--blue)' }}>Bukti {i + 1} ↗</a>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Tidak ada tugas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
