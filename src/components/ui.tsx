import { useEffect, useRef, useState } from 'react'
import type { PlaceResult } from '../types'
import { mapsUrl } from '../lib/api'

export function Logo({ variant = 'wordmark' }: { variant?: 'wordmark' | 'icon' | 'lockup' }) {
  const src = { wordmark: '/image/logo.png', icon: '/image/logo1.png', lockup: '/image/logo-real.png' }[variant]
  return <img className={`logo logo-${variant}`} src={src} alt="TugasGo" />
}

export function Badge({ children, tone = 'gray' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function NavIcon({ path, size = 18 }: { path: string; size?: number }) {
  const parts = path.trim().split(/(?= M)/)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {parts.map((d, i) => <path key={i} d={d.trim()} />)}
    </svg>
  )
}

export function MapEmbed({ lat, lng, height = 200 }: { lat: number; lng: number; height?: number }) {
  if (!lat || !lng) return null
  return (
    <div className="map-embed" style={{ height }}>
      <iframe title="Lokasi" src={mapsUrl(lat, lng)} width="100%" height="100%" style={{ border: 0, borderRadius: 11 }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
    </div>
  )
}

export function MapPlaceholder({ label = 'Belum ada lokasi dipilih', sub = '' }: { label?: string; sub?: string }) {
  return (
    <div className="map-placeholder">
      <span>⌖</span>
      <div><b>{label}</b>{sub && <small>{sub}</small>}</div>
    </div>
  )
}

declare global {
  interface Window { google: typeof google; __loadGoogleMaps: (key: string) => void }
}

export function PlacesAutocomplete({ onSelect }: { onSelect: (r: PlaceResult) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const acRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_KEY
    if (!key) return
    const init = () => {
      if (!inputRef.current || !window.google?.maps?.places) return
      acRef.current = new window.google.maps.places.Autocomplete(inputRef.current, { fields: ['name', 'formatted_address', 'geometry'], types: ['establishment', 'geocode'] })
      acRef.current.addListener('place_changed', () => {
        const p = acRef.current!.getPlace()
        if (!p.geometry?.location) return
        onSelect({ name: p.name || '', address: p.formatted_address || '', lat: p.geometry.location.lat(), lng: p.geometry.location.lng() })
      })
      setReady(true)
    }
    if (window.google?.maps?.places) { init(); return }
    window.__loadGoogleMaps(key)
    const t = setInterval(() => { if (window.google?.maps?.places) { clearInterval(t); init() } }, 300)
    return () => clearInterval(t)
  }, [onSelect])

  if (!import.meta.env.VITE_GOOGLE_MAPS_KEY)
    return <div className="map-placeholder"><span>⌖</span><div><b>Maps key belum diset</b></div></div>

  return (
    <div className="places-autocomplete">
      <input ref={inputRef} type="text" placeholder="Cari nama toko, kantor, atau tempat…" className="places-input" />
      {!ready && <small className="muted">Memuat Maps…</small>}
    </div>
  )
}
