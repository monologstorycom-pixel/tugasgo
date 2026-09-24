import { useEffect, useRef, useState } from 'react'
import { WS_URL, request } from './api'

export function useWebSocket(active: boolean, onMessage: (event: string, data: unknown) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const cbRef = useRef(onMessage)
  cbRef.current = onMessage

  useEffect(() => {
    if (!active) return
    let ws: WebSocket
    let timer: ReturnType<typeof setTimeout>
    let dead = false
    const connect = () => {
      if (dead) return
      ws = new WebSocket(WS_URL)
      wsRef.current = ws
      ws.onmessage = e => { try { const { event, data } = JSON.parse(e.data); cbRef.current(event, data) } catch { /**/ } }
      ws.onclose = () => { if (!dead) timer = setTimeout(connect, 3000) }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => { dead = true; clearTimeout(timer); ws?.close() }
  }, [active])

  return wsRef
}

export type GpsStatus = { state: 'idle' | 'requesting' | 'active' | 'warning' | 'error'; message: string; updatedAt: number | null }

export function useGpsTracking(active: boolean): GpsStatus {
  const [status, setStatus] = useState<GpsStatus>({ state: 'requesting', message: 'Meminta akses lokasi…', updatedAt: null })
  useEffect(() => {
    if (!active || !window.isSecureContext || !navigator.geolocation) return
    let lastSent = 0
    let sending = false
    const watchId = navigator.geolocation.watchPosition(async pos => {
      if (sending || Date.now() - lastSent < 7000) return
      sending = true
      try {
        await request('/location', { method: 'POST', body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }) })
        lastSent = Date.now()
        const accuracy = Math.round(pos.coords.accuracy)
        setStatus({ state: accuracy > 100 ? 'warning' : 'active', message: `${accuracy > 100 ? 'Akurasi GPS buruk' : 'Lokasi aktif'} · ±${accuracy} m`, updatedAt: lastSent })
      } catch (error) {
        setStatus({ state: 'error', message: error instanceof Error ? error.message : 'Lokasi gagal dikirim', updatedAt: null })
      } finally { sending = false }
    }, error => {
      const message = error.code === error.PERMISSION_DENIED ? 'Izin lokasi ditolak' : error.code === error.POSITION_UNAVAILABLE ? 'Lokasi tidak tersedia' : 'GPS tidak merespons'
      setStatus({ state: 'error', message, updatedAt: null })
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 })
    return () => navigator.geolocation.clearWatch(watchId)
  }, [active])
  if (!active) return { state: 'idle', message: 'GPS tidak aktif', updatedAt: null }
  if (!window.isSecureContext) return { state: 'error', message: 'GPS memerlukan koneksi HTTPS', updatedAt: null }
  if (!navigator.geolocation) return { state: 'error', message: 'GPS tidak didukung perangkat ini', updatedAt: null }
  return status
}
