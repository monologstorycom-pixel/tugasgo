import { useEffect, useState } from 'react'
import type { Task, Role, TaskEvent, SessionUser } from '../types'
import { request, uploadPhoto, dateTime, duration, elapsed, waitingAge, isOverDeadline, deadlineLabel } from '../lib/api'
import { Badge, MapEmbed } from '../components/ui'

export default function Detail({ task, role, user, onBack, onUpdate }: {
  task: Task; role: Role; user?: SessionUser | null; onBack: () => void
  onUpdate: (id: number, patch: Partial<Task>) => Promise<void>
}) {
  const [clock, setClock] = useState(() => Date.now())
  const [mode, setMode] = useState<'detail' | 'complete' | 'cancel'>('detail')
  const [note, setNote] = useState('')
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [events, setEvents] = useState<TaskEvent[]>([])

  useEffect(() => {
    if (task.status !== 'IN_PROGRESS') return
    const i = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(i)
  }, [task.status])

  useEffect(() => {
    request<{ events: TaskEvent[] }>(`/tasks/${task.id}/timeline`).then(r => setEvents(r.events)).catch(() => {})
  }, [task.id, task.status])

  const finish = async () => {
    if (!photoFiles.length) { setError('Minimal satu foto bukti wajib dipilih.'); return }
    setBusy(true); setError('')
    try {
      let lat: number | null = null, lng: number | null = null
      if (navigator.geolocation) {
        await new Promise<void>(resolve => navigator.geolocation.getCurrentPosition(
          pos => { lat = pos.coords.latitude; lng = pos.coords.longitude; resolve() },
          () => resolve(), { enableHighAccuracy: true, timeout: 5000 }
        ))
      }
      const photos = await Promise.all(photoFiles.map(f => uploadPhoto(f, 'COMPLETION')))
      await onUpdate(task.id, { status: 'COMPLETED', note: note.trim() || 'Tugas selesai tanpa catatan.', photos, completionLatitude: lat, completionLongitude: lng })
      onBack()
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menyelesaikan task') }
    finally { setBusy(false) }
  }

  const cancel = async () => {
    if (!reason.trim()) { setError('Alasan pembatalan wajib diisi.'); return }
    setBusy(true); setError('')
    try { await onUpdate(task.id, { status: 'CANCELLED', cancelReason: reason.trim() }); onBack() }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal membatalkan task') }
    finally { setBusy(false) }
  }

  if (mode === 'complete') return (
    <main className="page narrow">
      <button className="back" onClick={() => setMode('detail')}>‹ Kembali</button>
      <div className="page-head"><div><p className="eyebrow">BUKTI PENYELESAIAN</p><h1>Selesaikan tugas</h1></div></div>
      <div className="panel form">
        <label className="upload">
          <span>＋</span><b>Tambah foto bukti</b>
          <small>{photoFiles.length ? `${photoFiles.length} foto dipilih` : 'JPG/PNG'}</small>
          <input type="file" accept="image/*" multiple onChange={e => setPhotoFiles([...e.target.files || []])} />
        </label>
        {photoFiles.length > 0 && (
          <div className="photo-previews">
            {photoFiles.map((f, i) => <div key={i} className="photo-thumb"><img src={URL.createObjectURL(f)} alt={f.name} /><span>{f.name}</span></div>)}
          </div>
        )}
        <label>Catatan<textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="Dokumen diterima oleh…" /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary full" onClick={finish} disabled={busy}>{busy ? 'Menyimpan…' : 'Konfirmasi selesai'}</button>
      </div>
    </main>
  )

  if (mode === 'cancel') return (
    <main className="page narrow">
      <button className="back" onClick={() => setMode('detail')}>‹ Kembali</button>
      <div className="page-head"><div><p className="eyebrow">PEMBATALAN</p><h1>Batalkan tugas</h1></div></div>
      <div className="panel form">
        <label>Alasan<textarea rows={4} value={reason} onChange={e => setReason(e.target.value)} placeholder="Jelaskan alasan pembatalan" /></label>
        {error && <p className="error">{error}</p>}
        <button className="secondary danger full" onClick={cancel} disabled={busy}>{busy ? 'Membatalkan…' : 'Konfirmasi pembatalan'}</button>
      </div>
    </main>
  )

  return (
    <main className="page narrow">
      <button className="back" onClick={onBack}>‹ Kembali</button>
      <article className="detail panel">
        <div className="detail-top">
          <div>
            <div className="badge-row">
              <Badge tone={task.priority === 'URGENT' ? 'red' : 'gray'}>{task.priority}</Badge>
              <Badge tone={task.status === 'COMPLETED' ? 'green' : task.status === 'IN_PROGRESS' ? 'blue' : task.status === 'CANCELLED' ? 'red' : 'gray'}>{task.status.replace('_', ' ')}</Badge>
            </div>
            <h1>{task.title}</h1>
            <p>{task.status === 'WAITING' ? `Sudah ${waitingAge(task.created)} belum dikerjakan` : `Dibuat ${dateTime(task.created)}`} · {task.requester}</p>
          </div>
          {task.startedAt && (
            <div className="timer">
              <small>{task.status === 'IN_PROGRESS' ? 'BERJALAN' : 'DURASI'}</small>
              <strong>{duration(elapsed(task, clock))}</strong>
            </div>
          )}
        </div>

        {task.latitude && task.longitude
          ? <MapEmbed lat={task.latitude} lng={task.longitude} height={200} />
          : <div className="map-large"><span>⌖</span></div>
        }

        <div className="detail-grid">
          <div><small>TUJUAN</small><b>{task.destination}</b><span>{task.address}</span></div>
          <div><small>DIVISI · DRIVER</small><b>{task.division}</b><span>{task.assignee}</span></div>
        </div>

        <div className="instruction">
          <small>INSTRUKSI</small>
          <p>{task.description}</p>
          {task.referencePhoto && (
            <div className="ref-photo">
              <small>FOTO REFERENSI</small>
              {task.referencePhoto.startsWith('http') || task.referencePhoto.startsWith('blob')
                ? <img src={task.referencePhoto} alt="Referensi" className="photo-img" />
                : <p>{task.referencePhoto}</p>}
            </div>
          )}
        </div>

        <div className="meta-block">
          <div><small>DIBUAT</small><span>{dateTime(task.created)}</span></div>
          <div><small>PEMBUAT</small><span>{task.requester}</span></div>
          {task.urgentDeadline && !['COMPLETED','CANCELLED'].includes(task.status) && (
            <div>
              <small>BATAS WAKTU</small>
              <span className={isOverDeadline(task) ? 'deadline-over' : 'deadline-ok'}>
                {dateTime(task.urgentDeadline)}
                {' · '}{deadlineLabel(task)}
              </span>
            </div>
          )}
          {task.scheduledAt && (
            <div>
              <small>DIJADWALKAN</small>
              <span>{dateTime(task.scheduledAt)}</span>
            </div>
          )}
          {task.startedAt && <div><small>DIMULAI</small><span>{dateTime(task.startedAt)}</span></div>}
          {task.completedAt && <div><small>SELESAI</small><span>{dateTime(task.completedAt)}</span></div>}
          {task.cancelledAt && <div><small>DIBATALKAN</small><span>{dateTime(task.cancelledAt)}</span></div>}
          {!!task.durationSeconds && <div><small>DURASI</small><span>{duration(task.durationSeconds)}</span></div>}
          {task.cancelReason && <div><small>ALASAN BATAL</small><span>{task.cancelReason}</span></div>}
        </div>

        {task.completionLatitude && task.completionLongitude && (
          <div className="completion-loc">
            <small>LOKASI PENYELESAIAN</small>
            <MapEmbed lat={task.completionLatitude} lng={task.completionLongitude} height={140} />
          </div>
        )}

        {task.photos?.length ? (
          <div className="evidence">
            <small>BUKTI FOTO</small>
            {task.photos.map((p, i) => p.startsWith('http') || p.startsWith('blob')
              ? <img key={i} src={p} alt={`Bukti ${i + 1}`} className="photo-img" />
              : <span key={i}>{p}</span>
            )}
          </div>
        ) : null}

        {events.length > 0 && (
          <div className="timeline-mini">
            <small>RIWAYAT</small>
            {events.map(ev => (
              <div key={ev.id} className="tl-item">
                <span className={`event-dot ${ev.event_type.toLowerCase()}`} />
                <div>
                  <b>{ev.event_type.replace(/_/g, ' ')}</b>
                  <span> · {ev.actor_name}</span>
                  <small>{dateTime(new Date(ev.created_at).getTime())}</small>
                </div>
              </div>
            ))}
          </div>
        )}

        {role === 'Driver' && task.status === 'WAITING' ? (
          <div className="action-stack">
            {task.scheduledAt && (
              <div className="scheduled-notice">
                <span>🗓</span>
                <div>
                  <b>Tugas terjadwal</b>
                  <small>Jadwal pengerjaan: {dateTime(task.scheduledAt)}</small>
                </div>
              </div>
            )}
            {error && <p className="error">{error}</p>}
            <button
              className="primary full"
              disabled={busy}
              onClick={async () => {
                setBusy(true); setError('')
                try { await onUpdate(task.id, { status: 'IN_PROGRESS' }) }
                catch (e) { setError(e instanceof Error ? e.message : 'Gagal memulai') }
                finally { setBusy(false) }
              }}
            >
              {busy ? 'Memproses…' : 'Mulai tugas'}
            </button>
            <button className="danger secondary full" disabled={busy} onClick={() => setMode('cancel')}>Batalkan tugas</button>
          </div>
        ) : (role === 'Admin' || (role === 'Staff' && task.creatorId === user?.id)) && task.status === 'WAITING' ? (
          <div className="action-stack">
            {error && <p className="error">{error}</p>}
            <button className="danger secondary full" disabled={busy} onClick={() => setMode('cancel')}>Batalkan tugas</button>
          </div>
        ) : role === 'Driver' && task.status === 'IN_PROGRESS' ? (
          <button className="primary full" onClick={() => setMode('complete')}>Selesaikan tugas</button>
        ) : task.status === 'COMPLETED' ? (
          <div className="done-box"><b>Tugas selesai</b><p>{task.note}</p></div>
        ) : task.status === 'CANCELLED' ? (
          <div className="cancelled-box"><b>Tugas dibatalkan</b><p>{task.cancelReason}</p></div>
        ) : null}
      </article>
    </main>
  )
}
