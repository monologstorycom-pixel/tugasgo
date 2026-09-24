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
  if (user.role !== 'DRIVER' || Number(task.assigneeId) !== Number(user.id)) return false
  return (task.status === 'WAITING' && ['IN_PROGRESS','CANCELLED'].includes(next)) ||
    (task.status === 'IN_PROGRESS' && next === 'COMPLETED')
}

export function visibleTasks(user, tasks) {
  if (user.role === 'ADMIN') return tasks
  if (user.role === 'STAFF') return tasks.filter(task => Number(task.creatorId) === Number(user.id))
  return tasks.filter(task => Number(task.assigneeId) === Number(user.id))
}
