import { useRef, useState, useEffect } from 'react'
import type { Task, SessionUser, DriverOption } from '../types'
import { API, dateTime, elapsed, request } from '../lib/api'

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

export default function Report({ tasks }: { user?: SessionUser; tasks: Task[] }) {
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState<number>(0)
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [preview, setPreview] = useState<Preview | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const rangeInvalid = Boolean(from && to && from > to)
  const hasFilters = filter !== 'ALL' || search || from || to

  useEffect(() => {
    request<{ drivers: DriverOption[] }>('/drivers').then(r => {
      setDrivers(r.drivers)
      if (r.drivers.length > 0 && !selectedDriverId) {
        setSelectedDriverId(r.drivers[0].id)
      }
    }).catch(() => {})
  }, [selectedDriverId])

  const currentDriver = drivers.find(d => d.id === selectedDriverId) || drivers[0]

  const driverTasks = tasks.filter(task => {
    if (selectedDriverId && task.assigneeId !== selectedDriverId) return false
    if (filter !== 'ALL' && task.status !== filter) return false
    if (search && !`${task.title} ${task.destination} ${task.address} ${task.requester} ${task.division}`.toLocaleLowerCase('id-ID').includes(search.trim().toLocaleLowerCase('id-ID'))) return false
    if (from && task.created < localDateStart(from)) return false
    if (to && task.created > localDateEnd(to)) return false
    return true
  }).sort((a, b) => b.created - a.created)

  const completedWithDuration = driverTasks.filter(task => task.status === 'COMPLETED' && task.durationSeconds != null)
  const stats = {
    total: driverTasks.length,
    completed: driverTasks.filter(task => task.status === 'COMPLETED').length,
    cancelled: driverTasks.filter(task => task.status === 'CANCELLED').length,
    totalSec: driverTasks.reduce((sum, task) => sum + (task.durationSeconds || 0), 0),
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

  const exportExcel = async () => {
    setExporting(true)
    try {
      const q = new URLSearchParams()
      if (selectedDriverId) q.set('driverId', String(selectedDriverId))
      if (filter !== 'ALL') q.set('status', filter)
      if (from) q.set('from', from)
      if (to) q.set('to', to)
      const res = await fetch(`${API}/export/driver?${q}`, { credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Ekspor gagal')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `laporan-${(currentDriver?.name || 'driver').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`
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
          <p className="eyebrow">REKAP OPERASIONAL</p>
          <h1>Laporan driver</h1>
          <p>Pantau data tugas, durasi, bukti pekerjaan, dan ekspor excel per driver.</p>
        </div>
        <button className="primary" onClick={exportExcel} disabled={exporting || rangeInvalid}>
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
        <label>Pilih Driver
          <select value={selectedDriverId} onChange={e => setSelectedDriverId(Number(e.target.value))}>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
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

      <section className={`panel report-table driver-report-table ${historyOpen ? 'is-open' : ''}`}>
        <button className="driver-report-toggle" onClick={() => setHistoryOpen(open => !open)} aria-expanded={historyOpen} aria-controls="admin-driver-report-history">
          <span><b>Riwayat tugas {currentDriver ? currentDriver.name : ''}</b><small>{driverTasks.length} tugas sesuai filter</small></span>
          <span className="driver-report-chevron" aria-hidden="true" />
        </button>
        {historyOpen && <div id="admin-driver-report-history">
          <p className="driver-report-swipe">Geser tabel untuk melihat detail lainnya.</p>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabel riwayat tugas driver">
            <table>
              <thead>
                <tr>
                  <th>Tugas</th>
                  <th>Tujuan</th>
                  <th>Pemohon</th>
                  <th>Status</th>
                  <th>Waktu</th>
                  <th>Durasi</th>
                  <th>Catatan & bukti</th>
                </tr>
              </thead>
              <tbody>
                {driverTasks.map(task => {
                  const [statusLabel, statusColor] = statusMeta[task.status]
                  const photos = task.photos?.filter(validPhoto) || []
                  return (
                    <tr key={task.id}>
                      <td data-label="Tugas">
                        <b className="report-task-title">{task.title}</b>
                        <span className="report-task-meta">{task.division} · {task.priority === 'URGENT' ? 'Urgent' : 'Normal'}</span>
                      </td>
                      <td data-label="Tujuan">
                        <b>{task.destination}</b>
                        <span className="report-task-meta">{task.address}</span>
                      </td>
                      <td data-label="Pemohon">
                        <b>{task.requester}</b>
                        <span className="report-task-meta">{task.division}</span>
                      </td>
                      <td data-label="Status"><span className={`badge ${statusColor}`}>{statusLabel}</span></td>
                      <td data-label="Waktu">
                        {task.scheduledAt && <span>Jadwal {dateTime(task.scheduledAt)}</span>}
                        <span>Dibuat {dateTime(task.created)}</span>
                        {task.startedAt && <span>Mulai {dateTime(task.startedAt)}</span>}
                        {(task.completedAt || task.cancelledAt) && <span>Akhir {dateTime(task.completedAt || task.cancelledAt!)}</span>}
                      </td>
                      <td data-label="Durasi">
                        {task.durationSeconds ? humanDuration(task.durationSeconds) : task.startedAt && task.status === 'IN_PROGRESS' ? humanDuration(elapsed(task)) : '—'}
                      </td>
                      <td data-label="Catatan & bukti">
                        {task.note && <p className="report-note"><b>Catatan:</b> {task.note}</p>}
                        {task.cancelReason && <p className="report-note"><b>Alasan batal:</b> {task.cancelReason}</p>}
                        {!task.note && !task.cancelReason && <span>—</span>}
                        <div className="report-photo-actions">
                          {task.referencePhoto && validPhoto(task.referencePhoto) && (
                            <button className="secondary" onClick={() => showPreview({ title: 'Foto referensi', photos: [task.referencePhoto!] })}>
                              Foto referensi
                            </button>
                          )}
                          {photos.length > 0 && (
                            <button className="secondary" onClick={() => showPreview({ title: 'Bukti pekerjaan', photos, note: task.note })}>
                              Bukti driver ({photos.length})
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!driverTasks.length && (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty">
                        <b>{hasFilters ? 'Tidak ada tugas yang cocok' : 'Belum ada riwayat tugas'}</b>
                        {hasFilters && <p>Ubah atau reset filter untuk melihat data lain.</p>}
                        {hasFilters && <button className="secondary" onClick={resetFilters}>Reset filter</button>}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>}
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
                <small>CATATAN DRIVER</small>
                <p>{preview.note}</p>
              </div>
            )}
          </div>
        )}
      </dialog>
    </main>
  )
}
