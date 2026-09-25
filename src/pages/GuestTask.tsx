import { useCallback, useEffect, useRef, useState } from 'react'
import type { DriverLocation, DriverOption, Division } from '../types'
import { API, duration } from '../lib/api'
import { Badge, Logo, MapEmbed, MapPlaceholder, NavIcon, PlacesAutocomplete } from '../components/ui'
import type { PlaceResult } from '../types'
import { LiveMap } from './Activity'

async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Gagal')
  return body as T
}

type PublicTodayTask = {
  title: string
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  priority: 'NORMAL' | 'URGENT'
  assignee: string
  division: string
  requester: string
  created: number
  startedAt: number | null
  scheduledAt: number | null
  referencePhoto: string | null
  photos: string[] | null
  note: string | null
  cancelReason: string | null
}

const statusMeta = {
  WAITING: ['Menunggu', ''],
  IN_PROGRESS: ['Sedang dikerjakan', 'blue'],
  COMPLETED: ['Selesai', 'green'],
  CANCELLED: ['Dibatalkan', 'red'],
} as const

export default function GuestTask() {
  const [tab, setTab] = useState<'create' | 'activity'>('create')
  const [todayTasks, setTodayTasks] = useState<PublicTodayTask[]>([])
  const [driverLocations, setDriverLocations] = useState<DriverLocation[]>([])
  const [locationClock, setLocationClock] = useState(0)
  const [clock, setClock] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')
  const [guestName, setGuestName] = useState('')
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [divisions, setDivisions] = useState<Division[]>([])
  const [assigneeId, setAssigneeId] = useState(0)
  const [divisionId, setDivisionId] = useState(0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL')
  const [urgentDeadline, setUrgentDeadline] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [destination, setDestination] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notAvailable, setNotAvailable] = useState(false)
  const [preview, setPreview] = useState<{ title: string, photos: string[], note?: string } | null>(null)
  const previewDialog = useRef<HTMLDialogElement>(null)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true); setHistoryError('')
    try {
      const [{ tasks }, { driverLocations: locations }] = await Promise.all([
        publicGet<{ tasks: PublicTodayTask[] }>('/public/tasks/today'),
        publicGet<{ driverLocations: Array<Omit<DriverLocation, 'taskId'> & { active: boolean }> }>('/public/driver-locations'),
      ])
      setTodayTasks(tasks)
      setDriverLocations(locations.map(location => ({ ...location, taskId: location.active ? -1 : null })))
      setLocationClock(Date.now())
    } catch (e) { setHistoryError(e instanceof Error ? e.message : 'Riwayat gagal dimuat') }
    finally { setHistoryLoading(false) }
  }, [])

  useEffect(() => {
    publicGet<{ settings: { guest_mode: string } }>('/settings').then(({ settings }) => {
      if (settings.guest_mode !== 'true') {
        window.location.href = '/'
        return
      }
      return Promise.all([
        publicGet<{ drivers: DriverOption[] }>('/public/drivers'),
        publicGet<{ divisions: Division[] }>('/public/divisions'),
        loadHistory(),
      ]).then(([d, div]) => {
        setDrivers(d.drivers)
        setDivisions(div.divisions)
        setAssigneeId(d.drivers[0]?.id || 0)
        setDivisionId(div.divisions[0]?.id || 0)
      })
    }).catch(() => setNotAvailable(true))
  }, [loadHistory])

  useEffect(() => {
    if (tab !== 'activity') return
    const timer = window.setInterval(loadHistory, 7000)
    return () => window.clearInterval(timer)
  }, [tab, loadHistory])

  useEffect(() => {
    if (tab !== 'activity' || !todayTasks.some(task => task.status === 'IN_PROGRESS' && task.startedAt != null)) return
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [tab, todayTasks])

  const showPreview = (title: string, photos: string[], note?: string) => {
    setPreview({ title, photos, note })
    window.requestAnimationFrame(() => previewDialog.current?.showModal())
  }

  const closePreview = () => {
    previewDialog.current?.close()
    setPreview(null)
  }

  const handlePlaceSelect = useCallback((r: PlaceResult) => {
    setDestination(r.name); setAddress(r.address); setLat(r.lat); setLng(r.lng)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guestName.trim()) { setError('Nama wajib diisi'); return }
    if (!title.trim() || !destination.trim() || !address.trim() || !assigneeId || !divisionId) {
      setError('Semua field wajib diisi'); return
    }
    setBusy(true); setError('')
    try {
      let referencePhoto: string | null = null
      if (referenceFile) {
        const form = new FormData()
        form.append('file', referenceFile)
        form.append('photoType', 'REFERENCE')
        const upload = await fetch(`${API}/public/upload`, { method: 'POST', body: form })
        const uploadBody = await upload.json().catch(() => ({}))
        if (!upload.ok) throw new Error(uploadBody.error || 'Upload foto gagal')
        referencePhoto = uploadBody.key || uploadBody.url
      }
      const res = await fetch(`${API}/public/tasks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          guestName: guestName.trim(),
          title: title.trim(),
          description: description.trim() || 'Tidak ada detail tambahan.',
          priority,
          urgentDeadline: priority === 'URGENT' && urgentDeadline ? urgentDeadline : null,
          scheduledAt: scheduledAt || null,
          assigneeId,
          divisionId,
          locationName: destination.trim(),
          address: address.trim(),
          latitude: lat,
          longitude: lng,
          referencePhoto,
        })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Gagal membuat tugas')
      await loadHistory()
      setTitle(''); setDescription(''); setDestination(''); setAddress(''); setLat(null); setLng(null); setReferenceFile(null)
      setTab('activity')
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal') }
    finally { setBusy(false) }
  }

  const activeTasks = todayTasks.filter(task => task.status === 'IN_PROGRESS').length
  const completedTasks = todayTasks.filter(task => task.status === 'COMPLETED').length
  const guestNav = [
    ['create', 'M12 4v16M4 12h16', 'Buat tugas'],
    ['activity', 'M3 17l4-8 4 4 4-6 4 6', 'Aktivitas'],
  ] as const

  if (notAvailable) return (
    <main className="loading">
      <div>
        <Logo variant="lockup" />
        <p style={{ marginTop: 24, color: 'var(--muted)' }}>Form ini tidak tersedia saat ini.</p>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Hubungi admin untuk mengaktifkan Guest Mode.</p>
      </div>
    </main>
  )

  return (
    <div className="shell guest-shell">
      <aside>
        <Logo />
        <nav>
          {guestNav.map(([value, path, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => { setTab(value); if (value !== 'create') loadHistory() }}><NavIcon path={path} />{label}</button>)}
        </nav>
        <div className="profile guest-profile">
          <span className="avatar">T</span>
          <div><b>Tanpa login</b><small>Guest Mode</small></div>
          <a href="/" title="Login Admin atau Driver">↗</a>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div className="mobile-logo"><Logo variant="icon" /></div>
          <div />
        </header>
        {tab === 'create' ? <main className="page narrow guest-create-page">
          <section className="guest-hero">
            <div><p className="eyebrow">PERMINTAAN DRIVER</p><h1>Buat tugas lapangan</h1><p>Lengkapi kebutuhan, tujuan, dan driver yang akan bertugas.</p></div>
          </section>
          <form className="form panel guest-create-form" onSubmit={submit}>
          <label>Judul tugas
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Contoh: Beli Kabel LAN" />
          </label>
          <label>
            Nama Anda
            <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Nama lengkap" required autoFocus />
          </label>
          <div className="form-grid">
            <label>Divisi
              <select value={divisionId} onChange={e => setDivisionId(Number(e.target.value))}>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label>Driver
              {drivers.length === 1
                ? <input value={drivers[0]?.name || ''} disabled />
                : <select value={assigneeId} onChange={e => setAssigneeId(Number(e.target.value))}>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
              }
            </label>
          </div>
          <label>Prioritas
            <select value={priority} onChange={e => setPriority(e.target.value as 'NORMAL' | 'URGENT')}>
              <option value="NORMAL">NORMAL</option>
              <option value="URGENT">URGENT</option>
            </select>
          </label>
          {priority === 'URGENT' && (
            <label>
              Estimasi batas waktu
              <input type="datetime-local" value={urgentDeadline} onChange={e => setUrgentDeadline(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
            </label>
          )}
          <label>Cari lokasi tujuan
            <PlacesAutocomplete onSelect={handlePlaceSelect} />
          </label>
          {destination && (
            <div className="selected-place">
              <b>{destination}</b>
              <span>{address}</span>
              {lat && lng && <small>{lat.toFixed(6)}, {lng.toFixed(6)}</small>}
            </div>
          )}
          {lat && lng
            ? <MapEmbed lat={lat} lng={lng} height={180} />
            : <MapPlaceholder label="Belum ada lokasi dipilih" />
          }
           <label>Instruksi
             <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Barang yang dibawa, PIC tujuan, atau catatan lain" rows={3} />
           </label>
           <label className={`guest-file-picker ${referenceFile ? 'has-file' : ''}`}>
             <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setReferenceFile(e.target.files?.[0] || null)} />
             <span className="guest-file-icon" aria-hidden="true">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5a1 1 0 001 1h12a1 1 0 001-1v-5" /></svg>
             </span>
             <span className="guest-file-copy">
               <b>{referenceFile ? referenceFile.name : 'Tambahkan foto referensi'}</b>
                <small>{referenceFile ? 'Ketuk untuk mengganti foto' : 'JPEG, PNG, atau WebP · maksimal 20MB'}</small>

             </span>
             <span className="guest-file-action">{referenceFile ? 'Ganti' : 'Pilih foto'}</span>
           </label>
           <label>
             Jadwalkan tugas
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
            <small className="muted">Kosongkan jika ingin driver mulai segera.</small>
          </label>
          {error && <p className="error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="secondary" onClick={() => setTab('activity')}>Batal</button>
            <button className="primary" disabled={busy}>{busy ? 'Membuat…' : 'Buat tugas'}</button>
          </div>
        </form>
        </main> : (
          <main className="page guest-activity-page">
            <section className="guest-activity-hero">
              <div><p className="eyebrow">MONITORING HARI INI</p><h1>Aktivitas driver</h1><p>Pantau posisi dan progres pekerjaan secara langsung.</p></div>
              {driverLocations.length > 0 && <span className="live-indicator"><i /> {driverLocations.length} terpantau</span>}
            </section>
            <section className="guest-activity-stats" aria-label="Ringkasan aktivitas">
              <div><small>TUGAS HARI INI</small><strong>{todayTasks.length}</strong></div>
              <div><small>SEDANG DIKERJAKAN</small><strong>{activeTasks}</strong></div>
              <div><small>SELESAI</small><strong>{completedTasks}</strong></div>
            </section>
            <section className="panel" style={{ marginBottom: 20, overflow: 'hidden' }}>
              <div className="section-title"><div><h2>Peta posisi driver</h2></div><span className="live"><i /> Live</span></div>
              <LiveMap driverLocations={driverLocations} tasks={[]} />
            </section>
            {driverLocations.length > 0 && <section className="panel driver-activity" style={{ marginBottom: 20 }}>
              <div className="section-title"><div><h2>Posisi driver</h2></div></div>
              <div className="driver-location-list">
                {driverLocations.map(location => {
                  const minutes = Math.round((locationClock - location.updatedAt) / 60000)
                  return <div className="driver-loc-row" key={location.driverId}>
                    <span className={`avatar ${location.taskId ? 'avatar-active' : ''}`}>{location.driverName.charAt(0)}</span>
                    <div>
                      <b>{location.driverName}</b>
                      {location.taskTitle && <span className="driver-task-detail">{location.taskTitle} · untuk {location.requester}</span>}
                      {location.destination && <span className="driver-task-detail">Tujuan: {location.destination}</span>}
                      {location.address && <small>{location.address}</small>}
                      <small>Posisi diperbarui {minutes < 1 ? 'baru saja' : `${minutes} menit lalu`}</small>
                    </div>
                    {location.taskId ? <Badge tone="green">AKTIF</Badge> : <Badge>IDLE</Badge>}
                  </div>
                })}
              </div>
            </section>}
            <section className="panel timeline">
              <div className="section-title"><div><h2>Timeline tugas</h2></div><button className="secondary" onClick={loadHistory} disabled={historyLoading}>{historyLoading ? 'Memuat…' : 'Perbarui'}</button></div>
              {historyError && <p className="error" role="alert">{historyError}</p>}
              {todayTasks.map((task, index) => {
                const [label, color] = statusMeta[task.status]
                return <div className="event" key={`${task.title}-${task.created}-${index}`}>
                  <span className={`event-dot ${task.status.toLowerCase()}`} />
                  <div>
                    <div><b>{task.title}</b><Badge tone={color}>{label}{task.status === 'IN_PROGRESS' && task.startedAt != null ? ` · ${duration(Math.max(0, Math.floor((clock - task.startedAt) / 1000)))}` : ''}</Badge></div>
                    <p>{task.division} · {task.requester} · {task.assignee}</p>
                    {task.status === 'CANCELLED' && task.cancelReason && <div className="cancel-reason"><small>ALASAN PEMBATALAN</small><p>{task.cancelReason}</p></div>}
                    <small>{new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(task.created)}</small>
                    {(task.referencePhoto || (task.status === 'COMPLETED' && task.photos?.length)) && <div className="event-actions">
                      {task.referencePhoto && <button className="secondary" onClick={() => showPreview('Foto referensi', [task.referencePhoto!])}>Foto referensi</button>}
                      {task.status === 'COMPLETED' && task.photos?.length ? <button className="secondary" onClick={() => showPreview('Bukti dari driver', task.photos!, task.note || undefined)}>Bukti driver</button> : null}
                    </div>}
                  </div>
                </div>
              })}
              {!historyLoading && !todayTasks.length && <div className="empty"><b>Belum ada aktivitas</b></div>}
            </section>
          </main>
        )}
      </div>
      <nav className="bottom-nav" aria-label="Menu guest">
        {guestNav.map(([value, path, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => { setTab(value); if (value !== 'create') loadHistory() }}><NavIcon path={path} size={20} />{label}</button>)}
      </nav>
      <dialog ref={previewDialog} className="evidence-dialog" onClose={() => setPreview(null)} onClick={e => { if (e.target === e.currentTarget) closePreview() }}>
        {preview && <div>
          <div className="evidence-dialog-title"><h2>{preview.title}</h2><button className="secondary" onClick={closePreview} aria-label="Tutup popup">Tutup</button></div>
          <div className="evidence-dialog-photos">{preview.photos.map((photo, index) => <img key={photo} src={photo} alt={`${preview.title} ${index + 1}`} />)}</div>
          {preview.note && <div className="driver-note"><small>CATATAN DRIVER</small><p>{preview.note}</p></div>}
        </div>}
      </dialog>
    </div>
  )
}
