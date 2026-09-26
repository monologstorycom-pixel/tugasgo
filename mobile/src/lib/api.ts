import AsyncStorage from '@react-native-async-storage/async-storage'
import { GpsPoint, Task } from './types'

export const API_BASE_URL = 'https://tugasgo.rsby.cloud/api'
export const WS_BASE_URL = 'wss://tugasgo.rsby.cloud/ws'

const TOKEN_KEY = '@tugasgo_token'
const OFFLINE_GPS_KEY = '@tugasgo_offline_gps'

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY)
}

export async function setAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token)
}

export async function removeAuthToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY)
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}`
    try {
      const body = await response.json()
      if (body.error) errorMsg = body.error
    } catch {}
    throw new Error(errorMsg)
  }

  return response.json()
}

// ── Task Actions ─────────────────────────────────────────────────────────────
export async function startTask(taskId: number): Promise<{ task: Task }> {
  return request<{ task: Task }>(`/tasks/${taskId}/start`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  })
}

export async function completeTask(
  taskId: number,
  data: { note?: string; photos: string[]; latitude?: number | null; longitude?: number | null }
): Promise<{ task: Task }> {
  return request<{ task: Task }>(`/tasks/${taskId}/complete`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function cancelTask(taskId: number, reason: string): Promise<{ task: Task }> {
  return request<{ task: Task }>(`/tasks/${taskId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  })
}

export async function fetchTasks(): Promise<{ tasks: Task[] }> {
  return request<{ tasks: Task[] }>('/tasks')
}

export async function fetchTaskTimeline(taskId: number): Promise<{ events: any[] }> {
  return request<{ events: any[] }>(`/tasks/${taskId}/timeline`)
}

// ── Push Token Registration ──────────────────────────────────────────────────
export async function registerPushToken(token: string, platform: 'ANDROID' | 'IOS' = 'ANDROID') {
  return request('/device/push-token', {
    method: 'POST',
    body: JSON.stringify({ token, platform, appVersion: '1.0.0' }),
  })
}

// ── GPS Tracking & Offline Buffer ─────────────────────────────────────────────
export async function sendLocation(latitude: number, longitude: number, accuracy: number | null) {
  try {
    await flushOfflineLocations()
    return await request('/location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, accuracy }),
    })
  } catch {
    await bufferOfflineLocation({
      latitude,
      longitude,
      accuracy,
      recordedAt: new Date().toISOString(),
    })
  }
}

export async function bufferOfflineLocation(point: GpsPoint) {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_GPS_KEY)
    const list: GpsPoint[] = raw ? JSON.parse(raw) : []
    list.push(point)
    if (list.length > 200) list.shift()
    await AsyncStorage.setItem(OFFLINE_GPS_KEY, JSON.stringify(list))
  } catch {}
}

export async function flushOfflineLocations() {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_GPS_KEY)
    if (!raw) return
    const list: GpsPoint[] = JSON.parse(raw)
    if (!list.length) return

    await request('/locations/batch', {
      method: 'POST',
      body: JSON.stringify({ locations: list }),
    })
    await AsyncStorage.removeItem(OFFLINE_GPS_KEY)
  } catch {}
}

// ── Photo Upload ─────────────────────────────────────────────────────────────
export async function uploadTaskPhoto(
  uri: string,
  photoType: 'REFERENCE' | 'COMPLETION' = 'COMPLETION'
): Promise<string> {
  const token = await getAuthToken()
  const filename = uri.split('/').pop() || `photo_${Date.now()}.jpg`
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

  const formData = new FormData()
  formData.append('file', {
    uri,
    name: filename,
    type: mimeType,
  } as any)
  formData.append('photoType', photoType)

  const headers: Record<string, string> = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers,
    body: formData,
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error || 'Gagal mengunggah foto bukti')
  }

  return (body.key || body.url) as string
}

// ── Time & Formatting Helpers ────────────────────────────────────────────────
export const formatDuration = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  if (m < 60) return `${m}m ${s < 10 ? '0' : ''}${s}s`
  const h = Math.floor(m / 60)
  return `${h}j ${m % 60}m`
}

export const formatAge = (created: number) => {
  const diff = Date.now() - created
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'baru saja'
  if (mins < 60) return `${mins} mnt lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.floor(hours / 24)} hari lalu`
}

export const formatDateTime = (timestamp: number) => {
  const d = new Date(timestamp)
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

