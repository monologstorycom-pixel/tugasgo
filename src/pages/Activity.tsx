import { useCallback, useEffect, useRef } from 'react'
import type { Task, Role, DriverLocation } from '../types'
import { age, duration, elapsed } from '../lib/api'
import { Badge } from '../components/ui'

declare global {
  interface Window { google: typeof google; __loadGoogleMaps: (key: string) => void }
}

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!)

export function LiveMap({ driverLocations, tasks }: { driverLocations: DriverLocation[]; tasks: Task[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapRef2 = useRef<google.maps.Map | null>(null)
  const markers = useRef<Map<number, google.maps.Marker>>(new Map())
  const infoWindow = useRef<google.maps.InfoWindow | null>(null)

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google?.maps || mapRef2.current) return
    const center = driverLocations[0] ? { lat: driverLocations[0].latitude, lng: driverLocations[0].longitude } : { lat: -7.2575, lng: 112.7521 }
    mapRef2.current = new window.google.maps.Map(mapRef.current, { center, zoom: 13, mapTypeControl: false, streetViewControl: false })
    infoWindow.current = new window.google.maps.InfoWindow()
  }, [driverLocations])

  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY
    if (!key) return
    if (window.google?.maps) { initMap(); return }
    window.__loadGoogleMaps(key)
    const t = setInterval(() => { if (window.google?.maps) { clearInterval(t); initMap() } }, 300)
    return () => clearInterval(t)
  }, [initMap])

  useEffect(() => {
    if (!mapRef2.current || !window.google?.maps) return
    driverLocations.forEach(dl => {
      const pos = { lat: dl.latitude, lng: dl.longitude }
      const activeTask = tasks.find(t => t.id === dl.taskId)
      const isActive = !!dl.taskId
      const taskTitle = activeTask?.title || dl.taskTitle
      const requester = activeTask?.requester || dl.requester
      const destination = activeTask?.destination || dl.destination
      const icon = { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: isActive ? '#176b46' : '#a2aaa5', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
      let marker = markers.current.get(dl.driverId)
      if (marker) {
        marker.setPosition(pos)
        marker.setIcon(icon)
        window.google.maps.event.clearListeners(marker, 'click')
      } else {
        marker = new window.google.maps.Marker({ position: pos, map: mapRef2.current!, title: dl.driverName, icon, label: { text: dl.driverName[0], color: '#fff', fontSize: '12px', fontWeight: '700' }, animation: window.google.maps.Animation.DROP })
        markers.current.set(dl.driverId, marker)
      }
      marker.addListener('click', () => {
        const minsAgo = Math.round((Date.now() - dl.updatedAt) / 60000)
        infoWindow.current?.setContent(`<div style="font-family:sans-serif;max-width:220px;overflow-wrap:anywhere"><b>${escapeHtml(dl.driverName)}</b><br/><span style="font-size:12px;color:#666">${isActive ? 'Sedang bertugas' : 'Idle'}</span>${taskTitle ? `<br/><strong style="font-size:12px">${escapeHtml(taskTitle)}</strong>` : ''}${requester ? `<br/><span style="font-size:12px">Untuk: ${escapeHtml(requester)}</span>` : ''}${destination ? `<br/><span style="font-size:12px">Tujuan: ${escapeHtml(destination)}</span>` : ''}<br/><span style="font-size:11px;color:#999">${minsAgo < 1 ? 'baru saja' : `${minsAgo}m lalu`}</span></div>`)
        infoWindow.current?.open(mapRef2.current!, marker)
      })
    })
    markers.current.forEach((m, id) => { if (!driverLocations.find(d => d.driverId === id)) { m.setMap(null); markers.current.delete(id) } })
    if (driverLocations.length > 1) {
      const bounds = new window.google.maps.LatLngBounds()
      driverLocations.forEach(dl => bounds.extend({ lat: dl.latitude, lng: dl.longitude }))
      mapRef2.current.fitBounds(bounds, 80)
    }
  }, [driverLocations, tasks])

  if (!import.meta.env.VITE_GOOGLE_MAPS_KEY) return <div className="map-placeholder live-map"><span>⌖</span><div><b>Maps key belum diset</b></div></div>

  return (
    <div className="live-map-wrap">
      <div ref={mapRef} className="live-map" />
      {driverLocations.length === 0 && <div className="live-map-empty"><span>⌖</span><p>Belum ada driver mengirim lokasi</p></div>}
    </div>
  )
}

export default function Activity({ tasks, role, driverLocations }: { tasks: Task[]; role: Role; driverLocations: DriverLocation[] }) {
  const visible = role === 'Driver' ? [] : tasks
  return (
    <main className="page">
      <div className="page-head">
        <div><h1>Aktivitas driver</h1></div>
        {driverLocations.length > 0 && <span className="live-indicator"><i /> {driverLocations.length} terpantau</span>}
      </div>
      <section className="panel" style={{ marginBottom: 20, overflow: 'hidden' }}>
        <div className="section-title"><div><h2>Peta posisi driver</h2></div><span className="live"><i /> Live</span></div>
        <LiveMap driverLocations={driverLocations} tasks={tasks} />
      </section>
      {driverLocations.length > 0 && (
        <section className="panel driver-activity" style={{ marginBottom: 20 }}>
          <div className="section-title"><div><h2>Posisi driver</h2></div></div>
          <div className="driver-location-list">
            {driverLocations.map(dl => {
              const at = tasks.find(t => t.id === dl.taskId)
              const mins = Math.round((Date.now() - dl.updatedAt) / 60000)
              return (
                <div key={dl.driverId} className="driver-loc-row">
                  <span className={`avatar ${dl.taskId ? 'avatar-active' : ''}`}>{dl.driverName[0]}</span>
                  <div>
                    <b>{dl.driverName}</b>
                    {at && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{at.title} · {at.division}</span>}
                    {at?.startedAt && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Durasi {duration(elapsed(at))}</span>}
                    <small>{mins < 1 ? 'baru saja' : `${mins} menit lalu`}</small>
                  </div>
                  {dl.taskId ? <Badge tone="green">AKTIF</Badge> : <Badge>IDLE</Badge>}
                </div>
              )
            })}
          </div>
        </section>
      )}
      <section className="panel timeline">
        <div className="section-title"><div><h2>Timeline tugas</h2></div></div>
        {[...visible].sort((a, b) => b.created - a.created).map(t => (
          <div className="event" key={t.id}>
            <span className={`event-dot ${t.status.toLowerCase()}`} />
            <div>
              <div><b>{t.title}</b><Badge tone={t.status === 'COMPLETED' ? 'green' : t.status === 'IN_PROGRESS' ? 'blue' : t.status === 'CANCELLED' ? 'red' : 'gray'}>{t.status.replace('_', ' ')}</Badge></div>
              <p>{t.division} · {t.requester} · {t.assignee}</p>
              <small>{age(t.created)} lalu</small>
            </div>
          </div>
        ))}
        {!visible.length && <div className="empty"><b>Belum ada aktivitas</b></div>}
      </section>
    </main>
  )
}
