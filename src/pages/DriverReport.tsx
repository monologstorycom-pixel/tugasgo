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
  const [historyOpen, setHistoryOpen] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [failedPhotos, setFailedPhotos] = useState<Set<number>>(new Set())
  const dialogRef = useRef<HTMLDialogElement>(null)
  const rangeInvalid = Boolean(from && to && from > to)
  const hasFilters = filter !== 'ALL' || search || from || to

  const myTasks = tasks.filter(task => {
    if (task.assigneeId !== user.id) return false
    if (filter !== 'ALL' && task.status !== filter) return false
    if (search && !`${task.title} ${task.destination} ${task.address}`.toLocaleLowerCase('id-ID').includes(search.trim().toLocaleLowerCase('id-ID'))) return false
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
    setFailedPhotos(new Set())
    setPreview(value)
    window.requestAnimationFrame(() => dialogRef.current?.showModal())
  }

  const closePreview = () => {
    dialogRef.current?.close()
    setPreview(null)
  }

  const resetFilters = () => {
    setFilter('ALL')
    setSearch('')
    setFrom('')
    setTo('')
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
      if (!res.ok) throw new Error('Export gagal')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `laporan-${user.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Export gagal')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="page driver-report-page">
      <div className="page-head driver-report-head">
        <div><p className="eyebrow">REKAP PEKERJAAN</p><h1>Laporan saya</h1><p>Ringkasan tugas dan bukti pekerjaan Anda.</p></div>
        <button className="primary" onClick={handleExport} disabled={exporting || rangeInvalid}>{exporting ? 'Menyiapkan…' : 'Export Excel'}</button>
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
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Contoh: antar dokumen" />
        </label>
        <label>Status
          <select value={filter} onChange={event => setFilter(event.target.value)}>
            <option value="ALL">Semua status</option>
            <option value="COMPLETED">Selesai</option>
            <option value="CANCELLED">Dibatalkan</option>
            <option value="IN_PROGRESS">Berjalan</option>
            <option value="WAITING">Menunggu</option>
          </select>
        </label>
        <label>Dari tanggal
          <input type="date" className="date-input" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} />
        </label>
        <label>Sampai tanggal
          <input type="date" className="date-input" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} />
        </label>
        {hasFilters && <button className="secondary" onClick={resetFilters}>Reset filter</button>}
        {rangeInvalid && <p className="error" role="alert">Tanggal akhir tidak boleh sebelum tanggal awal.</p>}
      </section>

      <section className={`panel report-table driver-report-table ${historyOpen ? 'is-open' : ''}`}>
        <button className="driver-report-toggle" onClick={() => setHistoryOpen(open => !open)} aria-expanded={historyOpen} aria-controls="driver-report-history">
          <span><b>Riwayat tugas</b><small>{myTasks.length} tugas sesuai filter</small></span>
          <span className="driver-report-chevron" aria-hidden="true" />
        </button>
        {historyOpen && <div id="driver-report-history">
        <p className="driver-report-swipe">Geser tabel untuk melihat detail lainnya.</p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabel riwayat tugas">
          <table>
            <thead><tr><th>Tugas</th><th>Tujuan</th><th>Status</th><th>Waktu</th><th>Durasi</th><th>Catatan & bukti</th></tr></thead>
            <tbody>
              {myTasks.map(task => {
                const [statusLabel, statusColor] = statusMeta[task.status]
                const photos = task.photos?.filter(validPhoto) || []
                return <tr key={task.id}>
                  <td data-label="Tugas"><b className="report-task-title">{task.title}</b><span className="report-task-meta">{task.division} · {task.priority === 'URGENT' ? 'Urgent' : 'Normal'}</span></td>
                  <td data-label="Tujuan"><b>{task.destination}</b><span className="report-task-meta">{task.address}</span></td>
                  <td data-label="Status"><span className={`badge ${statusColor}`}>{statusLabel}</span></td>
                  <td data-label="Waktu"><span>Dibuat {dateTime(task.created)}</span>{task.startedAt && <span>Mulai {dateTime(task.startedAt)}</span>}{(task.completedAt || task.cancelledAt) && <span>Akhir {dateTime(task.completedAt || task.cancelledAt!)}</span>}</td>
                  <td data-label="Durasi">{task.durationSeconds ? humanDuration(task.durationSeconds) : task.startedAt && task.status === 'IN_PROGRESS' ? humanDuration(elapsed(task)) : '—'}</td>
                  <td data-label="Catatan & bukti">
                    {task.note && <p className="report-note"><b>Catatan:</b> {task.note}</p>}
                    {task.cancelReason && <p className="report-note"><b>Alasan batal:</b> {task.cancelReason}</p>}
                    {!task.note && !task.cancelReason && <span>—</span>}
                    <div className="report-photo-actions">
                      {task.referencePhoto && validPhoto(task.referencePhoto) && <button className="secondary" onClick={() => showPreview({ title: 'Foto referensi', photos: [task.referencePhoto!] })}>Foto referensi</button>}
                      {photos.length > 0 && <button className="secondary" onClick={() => showPreview({ title: 'Bukti pekerjaan', photos, note: task.note })}>Bukti driver ({photos.length})</button>}
                    </div>
                  </td>
                </tr>
              })}
              {!myTasks.length && <tr><td colSpan={6}><div className="empty"><b>{hasFilters ? 'Tidak ada tugas yang cocok' : 'Belum ada riwayat tugas'}</b>{hasFilters && <p>Ubah atau reset filter untuk melihat data lain.</p>}{hasFilters && <button className="secondary" onClick={resetFilters}>Reset filter</button>}</div></td></tr>}
            </tbody>
          </table>
        </div>
        </div>}
      </section>

      <dialog ref={dialogRef} className="evidence-dialog driver-report-dialog" onClose={() => setPreview(null)} onClick={event => { if (event.target === event.currentTarget) closePreview() }}>
        {preview && <div>
          <div className="evidence-dialog-title"><div><p className="eyebrow">DOKUMENTASI</p><h2>{preview.title}</h2></div><button className="secondary" onClick={closePreview}>Tutup</button></div>
          <div className="evidence-dialog-photos">{preview.photos.map((photo, index) => <figure key={`${photo}-${index}`}>
            {failedPhotos.has(index) ? <div className="report-photo-error"><b>Foto tidak dapat dimuat</b><small>Tautan mungkin kedaluwarsa atau jaringan bermasalah.</small></div> : <img src={photo} alt={`${preview.title} ${index + 1}`} loading="lazy" onError={() => setFailedPhotos(current => new Set(current).add(index))} />}
            <a className="secondary report-photo-download" href={photo} target="_blank" rel="noreferrer" download>Unduh foto {preview.photos.length > 1 ? index + 1 : ''}</a>
          </figure>)}</div>
          {preview.note && <div className="driver-note"><small>CATATAN DRIVER</small><p>{preview.note}</p></div>}
        </div>}
      </dialog>
    </main>
  )
}
