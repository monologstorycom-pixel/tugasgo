import { useEffect, useRef, useState } from 'react'
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
  const [preview, setPreview] = useState<Preview | null>(null)
  const [failedPhotos, setFailedPhotos] = useState<Set<number>>(new Set())
  const dialogRef = useRef<HTMLDialogElement>(null)
  const rangeInvalid = Boolean(from && to && from > to)
  const hasFilters = filter !== 'ALL' || search || from || to

  useEffect(() => {
    request<{ drivers: DriverOption[] }>('/drivers').then(r => {
      setDrivers(r.drivers)
      if (r.drivers.length > 0) {
        setSelectedDriverId(r.drivers[0].id)
      }
    }).catch(() => {})
  }, [])

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
    setFailedPhotos(new Set())
    window.requestAnimationFrame(() => dialogRef.current?.showModal())
  }

  const closePreview = () => {
    dialogRef.current?.close()
    setPreview(null)
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
      if (!res.ok) throw new Error('Ekspor gagal')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `laporan-${(currentDriver?.name || 'driver').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      alert('Gagal mengekspor laporan. Coba lagi.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="page driver-report-page">
      <div className="page-head driver-report-head">
        <div>
          <p className="eyebrow">LAPORAN KINERJA DRIVER</p>
          <h1>Laporan Driver & HR</h1>
          <p className="muted">Pantau data tugas, durasi kerja, bukti foto, dan ekspor excel per-driver.</p>
        </div>
      </div>

      <section className="stats driver-report-stats" aria-label="Ringkasan laporan">
        <div><small>TOTAL TUGAS</small><strong>{stats.total}</strong></div>
        <div><small>SELESAI</small><strong>{stats.completed}</strong></div>
        <div><small>DIBATALKAN</small><strong>{stats.cancelled}</strong></div>
        <div><small>RATA-RATA DURASI</small><strong className="driver-report-duration">{humanDuration(avgSec)}</strong></div>
      </section>

      <section className="panel driver-report-filter" aria-label="Filter laporan">
        <label>
          Pilih Driver
          <select value={selectedDriverId} onChange={e => setSelectedDriverId(Number(e.target.value))}>
            {drivers.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="ALL">Semua status</option>
            <option value="COMPLETED">Selesai</option>
            <option value="IN_PROGRESS">Sedang berjalan</option>
            <option value="WAITING">Menunggu</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
        </label>
        <label>
          Dari tanggal
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label>
          Sampai tanggal
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <label className="driver-report-search">
          Cari tugas
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nama tugas, tujuan, PIC..." />
        </label>
        <div className="driver-report-filter-actions">
          {hasFilters && (
            <button className="secondary" onClick={() => { setFilter('ALL'); setSearch(''); setFrom(''); setTo('') }}>
              Reset filter
            </button>
          )}
          <button className="primary" onClick={exportExcel} disabled={exporting || rangeInvalid}>
            {exporting ? 'Mengekspor…' : '📥 Ekspor Excel'}
          </button>
        </div>
        {rangeInvalid && <p className="error" role="alert">Rentang tanggal tidak valid. Tanggal awal harus lebih kecil atau sama dengan tanggal akhir.</p>}
      </section>

      <section className="panel driver-report-table-panel">
        <div className="section-title">
          <div>
            <h2>Riwayat tugas {currentDriver ? currentDriver.name : ''}</h2>
            <small>{driverTasks.length} tugas ditemukan</small>
          </div>
        </div>

        {driverTasks.length === 0 ? (
          <div className="empty"><b>Tidak ada riwayat tugas</b><p>Belum ada data tugas untuk driver/filter ini.</p></div>
        ) : (
          <div className="table-wrap driver-report-table-wrap" tabIndex={0} role="region" aria-label="Tabel laporan driver">
            <table className="driver-report-table">
              <thead>
                <tr>
                  <th scope="col">Tugas & Tujuan</th>
                  <th scope="col">Divisi & Pemohon</th>
                  <th scope="col">Jadwal / Dibuat</th>
                  <th scope="col">Waktu Selesai</th>
                  <th scope="col">Durasi</th>
                  <th scope="col">Status</th>
                  <th scope="col">Foto Bukti</th>
                </tr>
              </thead>
              <tbody>
                {driverTasks.map(task => {
                  const [statusText, statusTone] = statusMeta[task.status]
                  const validTaskPhotos = (task.photos || []).filter(validPhoto)
                  return (
                    <tr key={task.id}>
                      <td data-label="Tugas">
                        <b>{task.title}</b>
                        <small>{task.destination}</small>
                      </td>
                      <td data-label="Pemohon">
                        <span>{task.division}</span>
                        <small>{task.requester}</small>
                      </td>
                      <td data-label="Jadwal / Dibuat">
                        {task.scheduledAt ? (
                          <>
                            <b>{dateTime(task.scheduledAt)}</b>
                            <small>Dibuat: {dateTime(task.created)}</small>
                          </>
                        ) : (
                          <span>{dateTime(task.created)}</span>
                        )}
                      </td>
                      <td data-label="Selesai">
                        {task.completedAt ? dateTime(task.completedAt) : task.cancelledAt ? `Batal: ${dateTime(task.cancelledAt)}` : '—'}
                      </td>
                      <td data-label="Durasi">
                        {task.durationSeconds ? humanDuration(task.durationSeconds) : task.startedAt && task.status === 'IN_PROGRESS' ? elapsed(task) : '—'}
                      </td>
                      <td data-label="Status">
                        <span className={`driver-report-badge tone-${statusTone}`}>{statusText}</span>
                      </td>
                      <td data-label="Bukti" className="report-photo-cell">
                        <div className="report-photo-actions">
                          {task.referencePhoto && validPhoto(task.referencePhoto) && (
                            <button className="secondary" onClick={() => showPreview({ title: `Foto Referensi — ${task.title}`, photos: [task.referencePhoto!] })}>
                              Referensi
                            </button>
                          )}
                          {validTaskPhotos.length > 0 && (
                            <button className="secondary" onClick={() => showPreview({ title: `Bukti Selesai — ${task.title}`, photos: validTaskPhotos, note: task.note })}>
                              Bukti ({validTaskPhotos.length})
                            </button>
                          )}
                          {!task.referencePhoto && validTaskPhotos.length === 0 && <span className="muted">—</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <dialog ref={dialogRef} className="evidence-dialog driver-report-dialog" onClose={() => setPreview(null)} onClick={e => { if (e.target === e.currentTarget) closePreview() }}>
        {preview && (
          <div>
            <div className="evidence-dialog-title">
              <h2>{preview.title}</h2>
              <button className="secondary" onClick={closePreview} aria-label="Tutup popup">Tutup</button>
            </div>
            <div className="evidence-dialog-photos">
              {preview.photos.map((photo, index) => (
                <div key={photo} className="evidence-dialog-photo-item">
                  {!failedPhotos.has(index) ? (
                    <img
                      src={photo}
                      alt={`${preview.title} ${index + 1}`}
                      onError={() => setFailedPhotos(prev => new Set(prev).add(index))}
                    />
                  ) : (
                    <div className="evidence-dialog-photo-fallback">
                      <p>Gagal memuat pratinjau gambar</p>
                      <a href={photo} target="_blank" rel="noopener noreferrer">Buka tautan gambar ↗</a>
                    </div>
                  )}
                </div>
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
