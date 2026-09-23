import { useEffect, useRef } from 'react'
import { WS_URL, request } from './api'

export function useWebSocket(token: string | null, onMessage: (event: string, data: unknown) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const cbRef = useRef(onMessage)
  cbRef.current = onMessage

  useEffect(() => {
    if (!token) return
    let ws: WebSocket
    let timer: ReturnType<typeof setTimeout>
    let dead = false
    const connect = () => {
      if (dead) return
      ws = new WebSocket(WS_URL)
      wsRef.current = ws
      ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }))
      ws.onmessage = e => { try { const { event, data } = JSON.parse(e.data); cbRef.current(event, data) } catch { /**/ } }
      ws.onclose = () => { if (!dead) timer = setTimeout(connect, 3000) }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => { dead = true; clearTimeout(timer); ws?.close() }
  }, [token])

  return wsRef
}

export function useGpsTracking(active: boolean) {
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!active || !navigator.geolocation) return
    const send = () => navigator.geolocation.getCurrentPosition(
      pos => request('/location', { method: 'POST', body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }) }).catch(() => {}),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    )
    send()
    ref.current = setInterval(send, 7000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [active])
}
