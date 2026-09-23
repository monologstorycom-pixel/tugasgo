import { useMemo, useState } from 'react'
import type { SessionUser, Task, DriverLocation, TaskDraft, DriverOption, Division, View } from '../types'
import { duration, elapsed, sortDriverTasks } from '../lib/api'
import { useGpsTracking } from '../lib/hooks'
import { Badge, MapEmbed, MapPlaceholder, PlacesAutocomplete } from '../components/ui'
import type { PlaceResult } from '../types'
import { request, uploadPhoto } from '../lib/api'
import { useCallback } from 'react'
import TaskRow from '../components/TaskRow'

export function StaffDashboard({ user, tasks, onOpen, setView, driverLocations }: {
  user: SessionUser; tasks: Task[]; onOpen: (t: Task) => void
  setView: (v: View) => void; driverLocations: DriverLocation[]
}) {
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [priorityFilter, setPriorityFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const mine = tasks.filter(t => t.creatorId === user.id)
  const filtered = mine.filter(t => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false
    if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false
    if (dateFrom && t.created < new Date(dateFrom).getTime()) return false
    if (dateTo && t.created > new Date(dateTo + 'T23:59:59').getTime()) return false
    return true
  })
  const h = new Date().getHours()
  const greet = h < 12 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam'
  const activeDrivers = driverLocations.filter(dl => dl.taskId)

  return (
    <main className="page">
      <div className="page-head">
        <div><h1>Selamat {greet}, {user.name.split(' ')[0]}.</h1></div>
        <button className="primary" onClick={() => setView('create')}>+ Buat tugas</button>
      </div>
      <section className="stats">
        <div><small>TUGAS AKTIF</small><strong>{mine.filter(t => !['COMPLETED','CANCELLED'].includes(t.status)).length}</strong></div>
        <div><small>SEDANG DIKERJAKAN</small><strong>{mine.filter(t => t.status === 'IN_PROGRESS').length}</strong></div>
        <div><small>SELESAI</small><strong>{mine.filter(t => t.status === 'COMPLETED').length}</strong></div>
      </section>
      {activeDrivers.length > 0 && (
        <section className="panel driver-activity" style={{ marginBottom: 20 }}>
          <div className="section-title">
            <div><h2>Driver aktif</h2></div>
            <button className="secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => setView('activity')}>Lihat peta →</button>
          </div>
          <div className="driver-location-list">
            {activeDrivers.map(dl => {
              const t = tasks.find(x => x.id === dl.taskId)
              return (
                <div key={dl.driverId} className="driver-loc-row">
                  <span className="avatar avatar-active">{dl.driverName[0]}</span>
                  <div><b>{dl.driverName}</b><small>{t ? `${t.title} · ${t.division}` : 'Bertugas'}</small></div>
                  {t?.startedAt && <small className="muted">{duration(elapsed(t))}</small>}
                </div>
              )
            })}
          </div>
        </section>
      )}
      <section className="panel">
        <div className="section-title"><div><h2>Tugas saya</h2></div></div>
        <div className="filters task-filters">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">Semua status</option>
            <option value="WAITING">Waiting</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="ALL">Semua prioritas</option>
            <option value="NORMAL">Normal</option>
            <option value="URGENT">Urgent</option>
          </select>
          <input type="date" className="date-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input type="date" className="date-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div className="task-list">
          {filtered.length ? filtered.map(t => <TaskRow key={t.id} task={t} onOpen={onOpen} />) : (
            <div className="empty"><b>Tidak ada tugas</b></div>
          )}
        </div>
      </section>
    </main>
  )
}

export function DriverDashboard({ user, tasks, onOpen }: { user: SessionUser; tasks: Task[]; onOpen: (t: Task) => void }) {
  const sorted = useMemo(() => sortDriverTasks(tasks.filter(t => t.assigneeId === user.id)), [tasks, user.id])
  const active = sorted[0]?.status === 'IN_PROGRESS' ? sorted[0] : null
  useGpsTracking(!!active)

  return (
    <main className="page driver-page">
      <div className="page-head">
        <div><p className="eyebrow">TUGAS HARI INI</p><h1>Halo, {user.name.split(' ')[0]}.</h1></div>
        <span className="availability"><i /> Siap bertugas</span>
      </div>
      {active && (
        <section className="current">
          <p className="eyebrow">SEDANG DIKERJAKAN</p>
          <h2>{active.title}</h2>
          <p>{active.destination}</p>
          <button onClick={() => onOpen(active)}>Lanjutkan <span>›</span></button>
        </section>
      )}
      <section className="panel queue">
        <div className="section-title">
          <div><h2>Antrean tugas</h2></div>
          <Badge>{sorted.length} TUGAS</Badge>
        </div>
        <div className="task-list">
          {sorted.filter((_, i) => !active || i > 0).map(t => <TaskRow key={t.id} task={t} onOpen={onOpen} />)}
          {!sorted.length && <div className="empty"><b>Tidak ada tugas aktif</b></div>}
        </div>
      </section>
    </main>
  )
}

export function AdminOverview({ tasks, driverLocations }: { tasks: Task[]; driverLocations: DriverLocation[] }) {
  const [driverStats, setDriverStats] = useState({ total: 0, active: 0 })
  const activeDrivers = driverLocations.filter(dl => dl.taskId)
  const divisions = [...new Set(tasks.map(t => t.division))].filter(Boolean)

  useMemo(() => {
    request<{ users: { role: string; active: boolean }[] }>('/admin/users').then(r => {
      const drivers = r.users.filter(u => u.role === 'DRIVER')
      setDriverStats({ total: drivers.length, active: drivers.filter(u => u.active).length })
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="page">
      <div className="page-head"><div><h1>Operasional TugasGo</h1></div></div>
      <section className="stats admin-stats">
        <div><small>TOTAL DRIVER</small><strong>{driverStats.total}</strong></div>
        <div><small>DRIVER AKTIF</small><strong>{driverStats.active}</strong></div>
        <div><small>TOTAL TUGAS</small><strong>{tasks.length}</strong></div>
        <div><small>WAITING</small><strong>{tasks.filter(t => t.status === 'WAITING').length}</strong></div>
        <div><small>IN PROGRESS</small><strong>{tasks.filter(t => t.status === 'IN_PROGRESS').length}</strong></div>
        <div><small>URGENT</small><strong>{tasks.filter(t => t.priority === 'URGENT' && !['COMPLETED','CANCELLED'].includes(t.status)).length}</strong></div>
        <div><small>SELESAI</small><strong>{tasks.filter(t => t.status === 'COMPLETED').length}</strong></div>
        <div><small>DIBATALKAN</small><strong>{tasks.filter(t => t.status === 'CANCELLED').length}</strong></div>
      </section>
      {activeDrivers.length > 0 && (
        <section className="panel driver-activity" style={{ marginBottom: 20 }}>
          <div className="section-title"><div><h2>Driver aktif</h2></div></div>
          <div className="driver-location-list">
            {activeDrivers.map(dl => {
              const t = tasks.find(x => x.id === dl.taskId)
              return (
                <div key={dl.driverId} className="driver-loc-row">
                  <span className="avatar avatar-active">{dl.driverName[0]}</span>
                  <div><b>{dl.driverName}</b><small>{t ? `${t.title} · ${t.division}` : 'Bertugas'}</small></div>
                  {t?.startedAt && <small className="muted">{duration(elapsed(t))}</small>}
                </div>
              )
            })}
          </div>
        </section>
      )}
      <section className="panel division-table">
        <div className="section-title"><div><h2>Per Divisi</h2></div></div>
        {divisions.map(d => {
          const active = tasks.filter(t => t.division === d && !['COMPLETED','CANCELLED'].includes(t.status)).length
          const total = tasks.filter(t => t.division === d).length
          return (
            <div key={d}>
              <b>{d}</b>
              <span>{active} aktif / {total} total</span>
              <div className="bar"><i style={{ width: `${Math.max(4, Math.min(100, active * 20))}%` }} /></div>
            </div>
          )
        })}
      </section>
    </main>
  )
}

export function CreateTask({ user, onCreate, onCancel, drivers, divisions }: {
  user: SessionUser; onCreate: (t: TaskDraft & { assigneeId: number }) => Promise<void>
  onCancel: () => void; drivers: DriverOption[]; divisions: Division[]
}) {
  const [title, setTitle] = useState('')
  const [destination, setDestination] = useState('')
  const [address, setAddress] = useState('')
  const [priority, setPriority] = useState<import('../types').Priority>('NORMAL')
  const [urgentDeadline, setUrgentDeadline] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [description, setDescription] = useState('')
  const [refFile, setRefFile] = useState<File | null>(null)
  const [assigneeId, setAssigneeId] = useState(drivers[0]?.id || 0)
  const [divisionId, setDivisionId] = useState(user.divisionId || divisions[0]?.id || 0)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handlePlaceSelect = useCallback((r: PlaceResult) => {
    setDestination(r.name); setAddress(r.address); setLat(r.lat); setLng(r.lng)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !destination.trim() || !address.trim() || !assigneeId) { setError('Judul, lokasi, alamat, dan driver wajib diisi.'); return }
    setBusy(true); setError('')
    try {
      let referencePhoto: string | undefined
      if (refFile) referencePhoto = await uploadPhoto(refFile, 'REFERENCE')
      const div = divisions.find(d => d.id === divisionId)
      await onCreate({ title: title.trim(), destination: destination.trim(), address: address.trim(), priority, description: description.trim() || 'Tidak ada detail tambahan.', division: div?.name || '', assignee: drivers.find(d => d.id === assigneeId)?.name || '', assigneeId, latitude: lat, longitude: lng, referencePhoto, urgentDeadline: priority === 'URGENT' && urgentDeadline ? urgentDeadline : null, scheduledAt: scheduledAt || null })
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal membuat task') }
    finally { setBusy(false) }
  }

  return (
    <main className="page narrow">
      <button className="back" onClick={onCancel}>‹ Kembali</button>
      <div className="page-head"><div><h1>Buat tugas lapangan</h1></div></div>
      <form className="form panel" onSubmit={submit}>
        <label>Judul tugas<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Contoh: Beli Kabel LAN" autoFocus /></label>
        <div className="form-grid">
          {user.role === 'ADMIN'
            ? <label>Divisi<select value={divisionId} onChange={e => setDivisionId(Number(e.target.value))}>{divisions.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            : <label>Divisi<input value={divisions.find(d => d.id === user.divisionId)?.name || ''} disabled /></label>
          }
          <label>Driver
            {drivers.length === 1
              ? <input value={drivers[0].name} disabled />
              : <select value={assigneeId} onChange={e => setAssigneeId(Number(e.target.value))}>{drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            }
          </label>
        </div>
        <label>Prioritas<select value={priority} onChange={e => setPriority(e.target.value as import('../types').Priority)}><option>NORMAL</option><option>URGENT</option></select></label>
        {priority === 'URGENT' && (
          <label>
            Estimasi batas waktu
            <input
              type="datetime-local"
              value={urgentDeadline}
              onChange={e => setUrgentDeadline(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
            <small className="muted">Driver harus menyelesaikan sebelum waktu ini. Lewat batas akan ditandai.</small>
          </label>
        )}
        <label>Cari lokasi tujuan<PlacesAutocomplete onSelect={handlePlaceSelect} /></label>
        {destination && <div className="selected-place"><b>{destination}</b><span>{address}</span>{lat && lng && <small>{lat.toFixed(6)}, {lng.toFixed(6)}</small>}</div>}
        {lat && lng ? <MapEmbed lat={lat} lng={lng} height={200} /> : <MapPlaceholder label="Belum ada lokasi dipilih" />}
        <label>Instruksi<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Barang yang dibawa, PIC tujuan, atau catatan lain" rows={4} /></label>
        <label>
          Jadwalkan tugas
          <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
          <small className="muted">Kosongkan jika ingin driver mulai segera. Isi jika tugas untuk waktu mendatang.</small>
        </label>
        <label>Foto referensi<input type="file" accept="image/*" onChange={e => setRefFile(e.target.files?.[0] || null)} /><small>{refFile ? refFile.name : ''}</small></label>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onCancel}>Batal</button>
          <button className="primary" disabled={busy}>{busy ? 'Membuat…' : 'Buat tugas'}</button>
        </div>
      </form>
    </main>
  )
}
