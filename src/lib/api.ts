export const API = (() => {
  const base = import.meta.env.VITE_API_URL
  if (base) return base
  // auto-detect: gunakan host yang sama dengan browser, port 3001
  return `${window.location.protocol}//${window.location.hostname}:3001/api`
})()

export const WS_URL = (() => {
  const base = import.meta.env.VITE_WS_URL
  if (base) return base
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.hostname}:3001/ws`
})()
export const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Permintaan gagal')
  return body as T
}

export async function uploadPhoto(file: File, photoType: 'REFERENCE' | 'COMPLETION'): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  form.append('photoType', photoType)
  const res = await fetch(`${API}/upload`, { method: 'POST', credentials: 'include', body: form })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Upload gagal')
  if (body.placeholder || !body.url) return URL.createObjectURL(file)
  return body.url as string
}

export const roleName = (role: 'STAFF' | 'DRIVER' | 'ADMIN') =>
  ({ STAFF: 'Staff' as const, DRIVER: 'Driver' as const, ADMIN: 'Admin' as const })[role]

export const sortDriverTasks = (tasks: import('../types').Task[]) =>
  [...tasks].filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').sort((a, b) => {
    const rank = (t: import('../types').Task) => t.status === 'IN_PROGRESS' ? 0 : t.priority === 'URGENT' ? 1 : 2
    return rank(a) - rank(b) || a.created - b.created
  })

export const age = (created: number) => {
  const h = Math.floor((Date.now() - created) / 3_600_000)
  if (h < 1) return `${Math.max(1, Math.floor((Date.now() - created) / 60_000))} menit`
  return h < 24 ? `${h} jam` : `${Math.floor(h / 24)} hari`
}

export const waitingAge = (created: number) => {
  const h = Math.floor((Date.now() - created) / 3_600_000)
  if (h < 1) return `${Math.max(1, Math.floor((Date.now() - created) / 60_000))} menit`
  return h < 24 ? `${h} jam` : `${Math.floor(h / 24)} hari ${h % 24} jam`
}

export const duration = (s: number) =>
  [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':')

export const dateTime = (v: number) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(v)

export const elapsed = (task: import('../types').Task, clock = Date.now()) =>
  task.startedAt ? Math.max(0, Math.floor(((task.completedAt || task.cancelledAt || clock) - task.startedAt) / 1000)) : 0

export const mapsUrl = (lat: number, lng: number) =>
  MAPS_KEY
    ? `https://www.google.com/maps/embed/v1/place?key=${MAPS_KEY}&q=${lat},${lng}&zoom=15`
    : `https://maps.google.com/maps?q=${lat},${lng}&output=embed`

export const isOverDeadline = (task: import('../types').Task) =>
  task.priority === 'URGENT' &&
  task.urgentDeadline != null &&
  !['COMPLETED', 'CANCELLED'].includes(task.status) &&
  Date.now() > task.urgentDeadline

export const deadlineLabel = (task: import('../types').Task) => {
  if (!task.urgentDeadline) return null
  const diff = task.urgentDeadline - Date.now()
  if (diff < 0) {
    const over = Math.abs(diff)
    const h = Math.floor(over / 3_600_000)
    const m = Math.floor((over % 3_600_000) / 60_000)
    return h > 0 ? `Lewat ${h}j ${m}m` : `Lewat ${m} menit`
  }
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return h > 0 ? `Sisa ${h}j ${m}m` : `Sisa ${m} menit`
}
