import { useCallback, useEffect, useState } from 'react'
import type { DriverOption, Division } from '../types'
import { API, MAPS_KEY } from '../lib/api'
import { Logo, MapEmbed, MapPlaceholder, PlacesAutocomplete } from '../components/ui'
import type { PlaceResult } from '../types'

async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Gagal')
  return body as T
}

export default function GuestTask() {
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
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [notAvailable, setNotAvailable] = useState(false)

  useEffect(() => {
    Promise.all([
      publicGet<{ drivers: DriverOption[] }>('/public/drivers'),
      publicGet<{ divisions: Division[] }>('/public/divisions'),
    ]).then(([d, div]) => {
      setDrivers(d.drivers)
      setDivisions(div.divisions)
      setAssigneeId(d.drivers[0]?.id || 0)
      setDivisionId(div.divisions[0]?.id || 0)
    }).catch(() => setNotAvailable(true))
  }, [])

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
        })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Gagal membuat tugas')
      setDone(true)
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal') }
    finally { setBusy(false) }
  }

  if (notAvailable) return (
    <main className="loading">
      <div>
        <Logo variant="lockup" />
        <p style={{ marginTop: 24, color: 'var(--muted)' }}>Form ini tidak tersedia saat ini.</p>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Hubungi admin untuk mengaktifkan Guest Mode.</p>
      </div>
    </main>
  )

  if (done) return (
    <main className="loading">
      <div>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h2 style={{ fontFamily: 'Manrope', color: 'var(--green)' }}>Tugas berhasil dikirim</h2>
        <p style={{ color: 'var(--muted)', marginTop: 8 }}>Driver akan segera mendapat notifikasi.</p>
        <button className="primary" style={{ marginTop: 24 }} onClick={() => {
          setDone(false); setTitle(''); setDescription(''); setDestination('');
          setAddress(''); setLat(null); setLng(null); setGuestName('');
          setUrgentDeadline(''); setScheduledAt('');
        }}>Buat tugas lagi</button>
      </div>
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', display: 'grid', placeItems: 'start center', padding: '32px 16px 60px' }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <Logo variant="lockup" />
          <p style={{ color: 'var(--muted)', marginTop: 12, fontSize: 14 }}>Buat tugas lapangan</p>
        </div>
        <form className="form panel" onSubmit={submit}>
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
          <label>Judul tugas
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Contoh: Ambil dokumen ke notaris" />
          </label>
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
          <label>
            Jadwalkan tugas
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} min={new Date().toISOString().slice(0, 16)} />
            <small className="muted">Kosongkan jika ingin driver mulai segera.</small>
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary full" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim tugas'}</button>
        </form>
      </div>
    </main>
  )
}
