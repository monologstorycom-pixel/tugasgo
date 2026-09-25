import { useRef, useState } from 'react'
import type { Task, SessionUser } from '../types'
import { API, dateTime, elapsed } from '../lib/api'

const statusMeta = {
  WAITING: ['Menunggu', 'gray'],
  IN_PROGRESS: ['Berjalan', 'blue'],
  COMPLETED: ['Selesai', 'green'],
  CANCELLED: ['Dibatalkan', 'red'],
} as const

const humanDuration = (seconds: number | null | undefined): string => {
  if (!seconds || seconds <= 0) return '—'
  if (seconds < 60) return '< 1 menit'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d} hari ${h} jam ${m} menit`
  if (h > 0) return `${h} jam ${m} menit`
  return `${m} menit`
}

const localDateStart = (value: string) => new Date(`${value}T00:00:00`).getTime()
const localDateEnd = (value: string) => new Date(`${value}T23:59:59.999`).getTime()
const validPhoto = (value: string) => value.startsWith('http') || value.startsWith('blob:')

type Preview = { title: string; photos: string[]; note?: string }

export default function DriverReport({ user, tasks }: { user: SessionUser; tasks: Task[] }) {
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const rangeInvalid = Boolean(from && to && from > to)
  const hasFilters = filter !== 'ALL' || search || from || to

  const myTasks = tasks.filter(task => {
    if (task.assigneeId !== user.id) return false
    if (filter !== 'ALL' && task.status !== filter) return false
    if (search && !`${task.title} ${task.destination} ${task.address} ${task.requester} ${task.division}`.toLocaleLowerCase('id-ID').includes(search.trim().toLocaleLowerCase('id-ID'))) return false
    if (from && task.created < localDateStart(from)) return false
    if (to && task.created > localDateEnd(to)) return false
    return true
  }).sort((a, b) => b.created - a.created)

  const completedWithDuration = myTasks.filter(task => task.status === 'COMPLETED' && task.durationSeconds != null)
  const stats = {
    total: myTasks.length,
    completed: myTasks.filter(task => task.status === 'COMPLETED').length,
    cancelled: myTasks.filter(task => task.status === 'CANCELLED').length,
    totalSec: myTasks.reduce((sum, task) => sum + (task.durationSeconds || 0), 0),
  }
  const avgSec = completedWithDuration.length ? Math.round(stats.totalSec / completedWithDuration.length) : 0

  const showPreview = (value: Preview) => {
    setPreview(value)
    window.requestAnimationFrame(() => dialogRef.current?.showModal())
  }

  const closePreview = () => {
    dialogRef.current?.close()
    setPreview(null)
  }

  const resetFilters = () => {
    setFilter('ALL'); setSearch(''); setFrom(''); setTo('')
  }

  const toggleTask = (id: number) => {
    setExpandedTaskId(prev => prev === id ? null : id)
  }

  const handleExport = async () => {
    if (rangeInvalid) return
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'ALL') params.set('status', filter)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`${API}/export/driver?${params}`, { credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Ekspor gagal')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `laporan-${user.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal mengekspor laporan. Coba lagi.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="page driver-report-page">
      <div className="page-head driver-report-head">
        <div>
          <p className="eyebrow">REKAP PEKERJAAN</p>
          <h1>Laporan saya</h1>
          <p className="muted">Ringkasan tugas dan bukti pekerjaan Anda.</p>
        </div>
        <button className="primary" onClick={handleExport} disabled={exporting || rangeInvalid}>
          {exporting ? 'Menyiapkan…' : 'Export Excel'}
        </button>
      </div>

      <section className="stats driver-report-stats" aria-label="Ringkasan laporan">
        <div><small>TUGAS</small><strong>{stats.total}</strong></div>
        <div><small>SELESAI</small><strong>{stats.completed}</strong></div>
        <div><small>DIBATALKAN</small><strong>{stats.cancelled}</strong></div>
        <div><small>TOTAL DURASI</small><strong className="driver-report-duration">{humanDuration(stats.totalSec)}</strong></div>
      </section>
      {avgSec > 0 && <p className="driver-report-average">Rata-rata durasi tugas selesai <b>{humanDuration(avgSec)}</b></p>}

      <section className="panel driver-report-filter" aria-label="Filter laporan">
        <label className="driver-report-search">Cari tugas atau tujuan
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Contoh: antar dokumen" />
        </label>
        <label>Status
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="ALL">Semua status</option>
            <option value="COMPLETED">Selesai</option>
            <option value="CANCELLED">Dibatalkan</option>
            <option value="IN_PROGRESS">Berjalan</option>
            <option value="WAITING">Menunggu</option>
          </select>
        </label>
        <label>Dari tanggal
          <input type="date" className="date-input" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
        </label>
        <label>Sampai tanggal
          <input type="date" className="date-input" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
        </label>
        {hasFilters && <button className="secondary" onClick={resetFilters}>Reset filter</button>}
        {rangeInvalid && <p className="error" role="alert">Tanggal akhir tidak boleh sebelum tanggal awal.</p>}
      </section>

      <section className="panel" style={{ padding: '0 0 10px' }}>
        <div className="section-title" style={{ padding: '14px 18px 10px' }}>
          <div>
            <h2>Riwayat Tugas</h2>
            <small>{myTasks.length} tugas ditemukan</small>
          </div>
        </div>

        <div className="report-accordion-list">
          {myTasks.map(task => {
            const isExpanded = expandedTaskId === task.id
            const [statusLabel, statusColor] = statusMeta[task.status]
            const photos = task.photos?.filter(validPhoto) || []
            return (
              <div key={task.id} className={`report-card-item ${isExpanded ? 'open' : ''}`}>
                <button
                  type="button"
                  className="report-card-header"
                  onClick={() => toggleTask(task.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="report-card-head-left">
                    <b className="report-card-title">{task.title}</b>
                    <small className="report-card-sub">{task.destination} · {task.requester} ({task.division})</small>
                  </div>
                  <div className="report-card-head-right">
                    <span className={`badge ${statusColor}`}>{statusLabel}</span>
                    <span className="report-card-chevron">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="report-card-body">
                    <div className="report-card-grid">
                      <div>
                        <small>ALAMAT TUJUAN</small>
                        <span>{task.address || '—'}</span>
                      </div>
                      <div>
                        <small>PRIORITAS</small>
                        <span style={{ fontWeight: 700, color: task.priority === 'URGENT' ? 'var(--red)' : 'inherit' }}>{task.priority}</span>
                      </div>
                      <div>
                        <small>JADWAL PENGERJAAN</small>
                        <span>{task.scheduledAt ? dateTime(task.scheduledAt) : '—'}</span>
                      </div>
                      <div>
                        <small>DIBUAT</small>
                        <span>{dateTime(task.created)}</span>
                      </div>
                      <div>
                        <small>WAKTU MULAI</small>
                        <span>{task.startedAt ? dateTime(task.startedAt) : '—'}</span>
                      </div>
                      <div>
                        <small>WAKTU SELESAI / BATAL</small>
                        <span>{(task.completedAt || task.cancelledAt) ? dateTime(task.completedAt || task.cancelledAt!) : '—'}</span>
                      </div>
                      <div>
                        <small>DURASI PENGERJAAN</small>
                        <span>{task.durationSeconds ? humanDuration(task.durationSeconds) : task.startedAt && task.status === 'IN_PROGRESS' ? humanDuration(elapsed(task)) : '—'}</span>
                      </div>
                    </div>

                    {(task.note || task.cancelReason) && (
                      <div className="report-card-note-box">
                        {task.note && <p><b>Catatan Selesai:</b> {task.note}</p>}
                        {task.cancelReason && <p><b>Alasan Pembatalan:</b> {task.cancelReason}</p>}
                      </div>
                    )}

                    <div className="report-card-photo-actions">
                      {task.referencePhoto && validPhoto(task.referencePhoto) && (
                        <button type="button" className="secondary" onClick={() => showPreview({ title: `Foto referensi — ${task.title}`, photos: [task.referencePhoto!] })}>
                          🖼 Foto Referensi
                        </button>
                      )}
                      {photos.length > 0 && (
                        <button type="button" className="secondary" onClick={() => showPreview({ title: `Bukti pekerjaan — ${task.title}`, photos, note: task.note })}>
                          📸 Bukti Driver ({photos.length})
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {!myTasks.length && (
            <div className="empty" style={{ padding: '28px 16px' }}>
              <b>{hasFilters ? 'Tidak ada tugas yang cocok' : 'Belum ada riwayat tugas'}</b>
              {hasFilters && <p>Ubah atau reset filter untuk melihat data lain.</p>}
              {hasFilters && <button className="secondary" onClick={resetFilters}>Reset filter</button>}
            </div>
          )}
        </div>
      </section>

      <dialog ref={dialogRef} className="evidence-dialog driver-report-dialog" onClose={() => setPreview(null)} onClick={event => { if (event.target === event.currentTarget) closePreview() }}>
        {preview && (
          <div>
            <div className="evidence-dialog-title">
              <h2>{preview.title}</h2>
              <button className="secondary" onClick={closePreview} aria-label="Tutup popup">Tutup</button>
            </div>
            <div className="evidence-dialog-photos">
              {preview.photos.map((photo, index) => (
                <figure key={photo}>
                  <img src={photo} alt={`${preview.title} ${index + 1}`} />
                </figure>
              ))}
            </div>
            {preview.note && (
              <div className="driver-note">
                <small>CATATAN</small>
                <p>{preview.note}</p>
              </div>
            )}
          </div>
        )}
      </dialog>
    </main>
  )
}
