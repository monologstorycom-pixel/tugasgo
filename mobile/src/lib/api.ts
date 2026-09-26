import AsyncStorage from '@react-native-async-storage/async-storage'
import { GpsPoint } from './types'

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
    // Flush any buffered offline points first
    await flushOfflineLocations()
    return await request('/location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, accuracy }),
    })
  } catch {
    // If network fails, buffer locally
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
    // Keep max 200 points in buffer
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

// ── Direct GCS Photo Upload ───────────────────────────────────────────────────
export async function uploadTaskPhoto(
  uri: string,
  photoType: 'REFERENCE' | 'COMPLETION' = 'COMPLETION'
): Promise<string> {
  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg'
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg'

  // 1. Get presigned upload URL from backend
  const { uploadUrl, key } = await request<{ uploadUrl: string; key: string }>(
    '/uploads/request-url',
    {
      method: 'POST',
      body: JSON.stringify({ photoType, contentType, ext: ext === 'png' ? 'png' : 'jpg' }),
    }
  )

  // 2. Direct binary PUT upload to Google Cloud Storage
  const photoBlob = await (await fetch(uri)).blob()
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: photoBlob,
  })

  if (!uploadRes.ok) throw new Error('Gagal mengupload foto ke cloud storage')
  return key
}
