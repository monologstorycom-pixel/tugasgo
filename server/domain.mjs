import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 6) throw new Error('Password minimal 6 karakter')
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, 64)
  return `scrypt:${salt.toString('hex')}:${Buffer.from(derived).toString('hex')}`
}

export async function verifyPassword(password, stored) {
  try {
    const [algorithm, saltHex, digestHex] = stored.split(':')
    if (algorithm !== 'scrypt' || !saltHex || !digestHex) return false
    const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), 64))
    const expected = Buffer.from(digestHex, 'hex')
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch { return false }
}

export const createToken = () => randomBytes(32).toString('hex')
export const hashToken = token => createHash('sha256').update(token).digest('hex')

export function canTransition(user, task, next) {
  if (next === 'CANCELLED') {
    if (task.status !== 'WAITING') return false
    if (user.role === 'ADMIN') return true
    if (user.role === 'STAFF') return Number(task.creatorId) === Number(user.id)
    if (user.role === 'DRIVER') return Number(task.assigneeId) === Number(user.id)
    return false
  }
  if (user.role !== 'DRIVER' || Number(task.assigneeId) !== Number(user.id)) return false
  return (task.status === 'WAITING' && next === 'IN_PROGRESS') ||
    (task.status === 'IN_PROGRESS' && next === 'COMPLETED')
}

export function parseLocation(input) {
  const latitude = Number(input.latitude)
  const longitude = Number(input.longitude)
  const accuracy = input.accuracy == null ? null : Number(input.accuracy)
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error('Latitude tidak valid')
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Longitude tidak valid')
  if (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 10000)) throw new Error('Akurasi tidak valid')
  return { latitude, longitude, accuracy }
}

export const normalizeName = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID')

export function attendanceStatus(driverName, scansByName, currentHour = 11) {
  const scans = scansByName.get(normalizeName(driverName)) || []
  if (scans.length) return scans.some(time => time >= '16:30:00') ? 'OFF_DUTY' : 'AVAILABLE'
  return Number(currentHour) >= 11 ? 'ON_LEAVE' : 'AVAILABLE'
}

export function parseScheduledDate(value, tzOffset = '+07:00') {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const s = String(value).trim()
  if (!s) return null
  // If string doesn't specify timezone (like '2026-09-25T12:00' from datetime-local), apply local tzOffset
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(s)) {
    const full = s.length === 16 ? `${s}:00` : s
    const d = new Date(`${full}${tzOffset}`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function visibleTasks(user, tasks) {
  if (user.role === 'ADMIN') return tasks
  if (user.role === 'STAFF') return tasks.filter(task => Number(task.creatorId) === Number(user.id))
  return tasks.filter(task => Number(task.assigneeId) === Number(user.id))
}
