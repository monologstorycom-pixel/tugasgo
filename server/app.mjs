import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import mysql from 'mysql2/promise'
import { Storage } from '@google-cloud/storage'
import ExcelJS from 'exceljs'
import sharp from 'sharp'
import { attendanceStatus, canTransition, createToken, hashToken, normalizeName, verifyPassword, hashPassword, parseLocation } from './domain.mjs'

const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 10, timezone: 'Z' })
const port = Number(process.env.PORT || 3001)
const allowedOrigin = process.env.APP_ORIGIN || 'http://localhost:5173'
// Terima semua origin yang mengakses port 5173 (localhost dan IP lokal)
const isAllowedOrigin = origin => !origin || origin === allowedOrigin || /^http:\/\/192\.168\.\d+\.\d+:5173$/.test(origin) || origin === 'http://localhost:5173'
const cookieName = 'tugasgo_session'
const rateBuckets = new Map()
const rateLimit = (req, key, limit, windowMs) => {
  const id = `${key}:${req.socket.remoteAddress || 'unknown'}`
  const now = Date.now()
  const bucket = rateBuckets.get(id)
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(id, { count: 1, resetAt: now + windowMs })
    return
  }
  if (++bucket.count > limit) throw Object.assign(new Error('Terlalu banyak permintaan, coba lagi nanti'), { status: 429 })
}

// Google Cloud Storage — opsional, hanya aktif kalau env tersedia
const gcs = process.env.GCS_BUCKET ? new Storage(
  process.env.GCS_KEY_FILE ? { keyFilename: process.env.GCS_KEY_FILE } : {}
) : null
const gcsBucket = gcs ? gcs.bucket(process.env.GCS_BUCKET) : null

// ─── helpers ────────────────────────────────────────────────────────────────

const json = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers })
  res.end(JSON.stringify(body))
}
const parseCookies = req => Object.fromEntries(
  (req.headers.cookie || '').split(';').filter(Boolean)
    .map(v => v.trim().split(/=(.*)/s).slice(0, 2).map(decodeURIComponent))
)
const readBody = async req => {
  if ((req.headers['content-type'] || '').includes('multipart/form-data')) return {}
  const chunks = []; let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 5_000_000) throw Object.assign(new Error('Payload terlalu besar'), { status: 413 })
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}') }
  catch { throw Object.assign(new Error('JSON tidak valid'), { status: 400 }) }
}
const bearer = req => req.headers.authorization?.startsWith('Bearer ')
  ? req.headers.authorization.slice(7)
  : parseCookies(req)[cookieName]
const cookie = (token, maxAge = 60 * 60 * 12) =>
  `${cookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
const imageType = data => {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { contentType: 'image/jpeg', ext: 'jpg' }
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { contentType: 'image/png', ext: 'png' }
  if (data.length >= 12 && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') return { contentType: 'image/webp', ext: 'webp' }
  return null
}
const readUpload = async req => {
  const ct = req.headers['content-type'] || ''
  if (!ct.includes('multipart/form-data')) throw Object.assign(new Error('Harus multipart/form-data'), { status: 400 })
  const boundary = ct.split('boundary=')[1]?.trim().replace(/^"|"$/g, '')
  if (!boundary) throw Object.assign(new Error('Boundary tidak ditemukan'), { status: 400 })
  const chunks = []; let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 20_000_000) throw Object.assign(new Error('File terlalu besar (max 20MB)'), { status: 413 })
    chunks.push(chunk)
  }
  const buf = Buffer.concat(chunks)
  const parts = buf.toString('latin1').split(`--${boundary}`)
  let fileData = null; let photoType = 'COMPLETION'
  for (const raw of parts) {
    const headerEnd = raw.indexOf('\r\n\r\n')
    if (headerEnd < 0) continue
    const header = raw.slice(0, headerEnd)
    const body = Buffer.from(raw.slice(headerEnd + 4).replace(/\r\n$/, ''), 'latin1')
    if (header.includes('name="photoType"')) photoType = body.toString().trim()
    else if (header.includes('filename=')) fileData = body
  }
  if (!fileData) throw Object.assign(new Error('File tidak ditemukan'), { status: 400 })
  if (!['REFERENCE', 'COMPLETION'].includes(photoType)) throw Object.assign(new Error('photoType tidak valid'), { status: 400 })
  const type = imageType(fileData)
  if (!type) throw Object.assign(new Error('File harus JPEG, PNG, atau WebP'), { status: 400 })
  return { fileData, photoType, ...type }
}

// ─── row mappers ─────────────────────────────────────────────────────────────

const rowTask = row => ({
  id: Number(row.id), title: row.title, description: row.description,
  priority: row.priority, status: row.status,
  creatorId: Number(row.creator_id), requester: row.requester,
  division: row.division, assigneeId: Number(row.assignee_id), assignee: row.assignee,
  destination: row.location_name, address: row.address,
  latitude: row.latitude ? Number(row.latitude) : null,
  longitude: row.longitude ? Number(row.longitude) : null,
  referencePhoto: row.reference_photo,
  photos: typeof row.completion_photos === 'string' ? JSON.parse(row.completion_photos) : row.completion_photos,
  note: row.completion_note, cancelReason: row.cancel_reason,
  cancelledBy: row.cancelled_by ? Number(row.cancelled_by) : null,
  urgentDeadline: row.urgent_deadline ? new Date(row.urgent_deadline).getTime() : null,
  scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).getTime() : null,
  completionLatitude: row.completion_latitude ? Number(row.completion_latitude) : null,
  completionLongitude: row.completion_longitude ? Number(row.completion_longitude) : null,
  created: new Date(row.created_at).getTime(),
  startedAt: row.started_at ? new Date(row.started_at).getTime() : undefined,
  completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
  cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).getTime() : undefined,
  durationSeconds: row.started_at && row.completed_at
    ? Math.floor((new Date(row.completed_at) - new Date(row.started_at)) / 1000) : null,
})
const photoUrl = async value => {
  if (!value || /^https?:\/\//i.test(value) || value.startsWith('blob:') || !gcsBucket) return value
  const [url] = await gcsBucket.file(value).getSignedUrl({ action: 'read', expires: Date.now() + 60 * 60 * 1000 })
  return url
}
const presentTask = async task => ({
  ...task,
  referencePhoto: await photoUrl(task.referencePhoto),
  photos: await Promise.all((task.photos || []).map(photoUrl)),
})
const taskSelect = `SELECT t.*,COALESCE(t.guest_creator_name,creator.name) requester,d.name division,assignee.name assignee
  FROM tasks t
  JOIN users creator ON creator.id=t.creator_id
  JOIN divisions d ON d.id=t.division_id
  JOIN users assignee ON assignee.id=t.assignee_id`

// ─── auth helpers ─────────────────────────────────────────────────────────────

async function auth(req) {
  const token = bearer(req)
  if (!token) return null
  const [rows] = await pool.execute(
    `SELECT u.id,u.name,u.username,u.role,u.division_id divisionId
     FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=? AND s.expires_at>CURRENT_TIMESTAMP(3) AND u.active=TRUE`,
    [hashToken(token)]
  )
  return rows[0] ? { ...rows[0], id: Number(rows[0].id), divisionId: rows[0].divisionId ? Number(rows[0].divisionId) : null } : null
}
const requireUser = async req => {
  const user = await auth(req)
  if (!user) throw Object.assign(new Error('Autentikasi diperlukan'), { status: 401 })
  return user
}
const requireRole = (user, ...roles) => {
  if (!roles.includes(user.role)) throw Object.assign(new Error('Akses ditolak'), { status: 403 })
}
const getTask = async id => {
  const [rows] = await pool.execute(`${taskSelect} WHERE t.id=?`, [id])
  return rows[0] ? rowTask(rows[0]) : null
}
const canView = (user, task) =>
  user.role === 'ADMIN' ||
  (user.role === 'STAFF' && task.creatorId === user.id) ||
  (user.role === 'DRIVER' && task.assigneeId === user.id)

// ─── WebSocket broadcast ──────────────────────────────────────────────────────

const clients = new Map() // userId → Set<ws>

function broadcast(userIds, event, data) {
  const msg = JSON.stringify({ event, data })
  for (const uid of userIds) {
    const sockets = clients.get(uid)
    if (!sockets) continue
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(msg)
    }
  }
}

async function notifyTaskEvent(taskId, type, actorId) {
  const task = await getTask(taskId)
  if (!task) return
  const messages = {
    TASK_CREATED: `Tugas baru: ${task.title}`,
    TASK_STARTED: `${task.assignee} mulai mengerjakan: ${task.title}`,
    TASK_COMPLETED: `Tugas selesai: ${task.title}`,
    TASK_CANCELLED: `Tugas dibatalkan: ${task.title}`,
  }
  const msg = messages[type] || type

  // tentukan siapa yang dapat notif
  const recipientIds = new Set()
  if (type === 'TASK_CREATED') {
    // notif ke driver yang ditugaskan
    recipientIds.add(task.assigneeId)
  } else {
    // notif ke creator task
    recipientIds.add(task.creatorId)
  }
  // admin selalu dapat
  const [admins] = await pool.query("SELECT id FROM users WHERE role='ADMIN' AND active=TRUE")
  for (const a of admins) recipientIds.add(Number(a.id))
  recipientIds.delete(actorId) // jangan notif diri sendiri

  for (const uid of recipientIds) {
    await pool.execute(
      'INSERT INTO notifications(user_id,type,task_id,message) VALUES(?,?,?,?)',
      [uid, type, taskId, msg]
    )
  }
  // broadcast realtime
  broadcast([...recipientIds], 'notification', { type, taskId, message: msg })
  // broadcast task update ke semua yang bisa lihat
  broadcast([task.creatorId, task.assigneeId, ...admins.map(a => Number(a.id))], 'task_updated', { task: await presentTask(task) })
}

// ─── HTTP handler ─────────────────────────────────────────────────────────────

export async function handler(req, res) {
  const origin = req.headers.origin
  if (origin && !isAllowedOrigin(origin)) return json(res, 403, { error: 'Origin ditolak' })
  const cors = {
    'access-control-allow-origin': origin || allowedOrigin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'vary': 'Origin'
  }
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v))
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const p = url.pathname

    // ── health ──────────────────────────────────────────────────────────────
    if (req.method === 'GET' && p === '/api/health') {
      await pool.query('SELECT 1')
      return json(res, 200, { ok: true })
    }

    // ── settings (public read) ────────────────────────────────────────────────
    if (req.method === 'GET' && p === '/api/settings') {
      const [[row]] = await pool.query("SELECT val FROM app_settings WHERE setting_key='guest_mode'")
      return json(res, 200, { settings: { guest_mode: row?.val || 'false' } })
    }

    if (req.method === 'PATCH' && p === '/api/admin/settings') {
      const user = await requireUser(req)
      requireRole(user, 'ADMIN')
      const { guest_mode: guestMode } = await readBody(req)
      if (!['true', 'false'].includes(String(guestMode))) return json(res, 400, { error: 'Guest mode tidak valid' })
      await pool.execute(
        'INSERT INTO app_settings(setting_key,val) VALUES(?,?) ON DUPLICATE KEY UPDATE val=VALUES(val)',
        ['guest_mode', String(guestMode)]
      )
      return json(res, 200, { ok: true })
    }

    if (req.method === 'POST' && p === '/api/admin/attendance/sync') {
      const user = await requireUser(req)
      requireRole(user, 'ADMIN')
      await syncAttendance()
      return json(res, 200, { ok: true, message: 'Sinkronisasi absensi berhasil' })
    }

    // ── public endpoints (guest mode) ─────────────────────────────────────────
    if (req.method === 'GET' && p === '/api/public/drivers') {
      const [[guestRow]] = await pool.query("SELECT val FROM app_settings WHERE setting_key='guest_mode'")
      if (!guestRow || guestRow.val !== 'true') return json(res, 403, { error: 'Guest mode tidak aktif' })
      const [rows] = await pool.query("SELECT id,name,availability_status FROM users WHERE role='DRIVER' AND active=TRUE ORDER BY name")
      return json(res, 200, { drivers: rows.map(x => ({ id: Number(x.id), name: x.name, availability_status: x.availability_status })) })
    }

    if (req.method === 'GET' && p === '/api/public/divisions') {
      const [[guestRow]] = await pool.query("SELECT val FROM app_settings WHERE setting_key='guest_mode'")
      if (!guestRow || guestRow.val !== 'true') return json(res, 403, { error: 'Guest mode tidak aktif' })
      const [rows] = await pool.query('SELECT id,name FROM divisions WHERE active=TRUE ORDER BY name')
      return json(res, 200, { divisions: rows.map(x => ({ ...x, id: Number(x.id) })) })
    }

    if (req.method === 'GET' && p === '/api/public/tasks/today') {
      rateLimit(req, 'guest-history', 60, 60 * 1000)
      const [[guestRow]] = await pool.query("SELECT val FROM app_settings WHERE setting_key='guest_mode'")
      if (!guestRow || guestRow.val !== 'true') return json(res, 403, { error: 'Guest mode tidak aktif' })
      const [rows] = await pool.query(
        `SELECT t.title,t.status,t.priority,t.created_at,t.started_at,t.scheduled_at,t.reference_photo,
          t.completion_photos,t.completion_note,t.cancel_reason,u.name assignee,d.name division,
          COALESCE(t.guest_creator_name,creator.name) requester
         FROM tasks t
         JOIN users u ON u.id=t.assignee_id
         JOIN users creator ON creator.id=t.creator_id
         JOIN divisions d ON d.id=t.division_id
         WHERE t.status IN ('WAITING','IN_PROGRESS')
            OR (t.created_at>=CURRENT_DATE() AND t.created_at<DATE_ADD(CURRENT_DATE(),INTERVAL 1 DAY))
            OR (t.scheduled_at>=CURRENT_DATE() AND t.scheduled_at<DATE_ADD(CURRENT_DATE(),INTERVAL 1 DAY))
            OR (t.completed_at>=CURRENT_DATE() AND t.completed_at<DATE_ADD(CURRENT_DATE(),INTERVAL 1 DAY))
            OR (t.cancelled_at>=CURRENT_DATE() AND t.cancelled_at<DATE_ADD(CURRENT_DATE(),INTERVAL 1 DAY))
         ORDER BY CASE t.status WHEN 'IN_PROGRESS' THEN 0 WHEN 'WAITING' THEN 1 ELSE 2 END, t.created_at DESC`
      )
      return json(res, 200, { tasks: await Promise.all(rows.map(async row => ({
        title: row.title,
        status: row.status,
        priority: row.priority,
        assignee: row.assignee,
        division: row.division,
        requester: row.requester,
        created: new Date(row.created_at).getTime(),
        startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
        scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).getTime() : null,
        referencePhoto: await photoUrl(row.reference_photo),
        photos: await Promise.all((typeof row.completion_photos === 'string' ? JSON.parse(row.completion_photos) : row.completion_photos || []).map(photoUrl)),
        note: row.completion_note,
        cancelReason: row.cancel_reason,
      }))) })
    }

    if (req.method === 'GET' && p === '/api/public/driver-locations') {
      rateLimit(req, 'guest-locations', 120, 60 * 1000)
      const [[guestRow]] = await pool.query("SELECT val FROM app_settings WHERE setting_key='guest_mode'")
      if (!guestRow || guestRow.val !== 'true') return json(res, 403, { error: 'Guest mode tidak aktif' })
      const [rows] = await pool.query(
        `SELECT dll.driver_id,dll.task_id,dll.latitude,dll.longitude,dll.accuracy,dll.updated_at,u.name driver_name,
          t.title task_title,t.location_name,t.address,d.name division,
          COALESCE(t.guest_creator_name,creator.name) requester
         FROM driver_last_location dll
         JOIN users u ON u.id=dll.driver_id
          JOIN tasks t ON t.id=dll.task_id AND t.status='IN_PROGRESS'
          LEFT JOIN users creator ON creator.id=t.creator_id
          LEFT JOIN divisions d ON d.id=t.division_id
          WHERE u.role='DRIVER' AND u.active=TRUE AND dll.updated_at>=DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 2 MINUTE)`

      )
      return json(res, 200, { driverLocations: rows.map(row => ({
        driverId: Number(row.driver_id),
        driverName: row.driver_name,
        active: row.task_title != null,
        latitude: Number(Number(row.latitude).toFixed(4)),
        longitude: Number(Number(row.longitude).toFixed(4)),
        accuracy: row.accuracy == null ? null : Number(row.accuracy),
        updatedAt: new Date(row.updated_at).getTime(),
        taskTitle: row.task_title,
        destination: row.location_name,
        division: row.division,
      })) })
    }

    if (req.method === 'POST' && p === '/api/public/tasks') {
      rateLimit(req, 'guest-task', 10, 60 * 60 * 1000)
      const [[guestRow]] = await pool.query("SELECT val FROM app_settings WHERE setting_key='guest_mode'")
      if (!guestRow || guestRow.val !== 'true') return json(res, 403, { error: 'Guest mode tidak aktif' })
      const b = await readBody(req)
      if (!b.guestName?.trim()) return json(res, 400, { error: 'Nama wajib diisi' })
      for (const key of ['title', 'description', 'locationName', 'address'])
        if (typeof b[key] !== 'string' || !b[key].trim()) return json(res, 400, { error: `${key} wajib diisi` })
      if (!['NORMAL', 'URGENT'].includes(b.priority)) return json(res, 400, { error: 'Priority tidak valid' })
      const assigneeId = Number(b.assigneeId)
      if (!Number.isSafeInteger(assigneeId)) return json(res, 400, { error: 'Driver tidak valid' })
      const [drivers] = await pool.execute("SELECT id FROM users WHERE id=? AND role='DRIVER' AND active=TRUE AND availability_status='AVAILABLE'", [assigneeId])
      if (!drivers.length) return json(res, 400, { error: 'Driver tidak aktif atau sedang libur' })
      const divisionId = Number(b.divisionId)
      if (!Number.isSafeInteger(divisionId)) return json(res, 400, { error: 'Divisi tidak valid' })
      const [divisions] = await pool.execute('SELECT id FROM divisions WHERE id=? AND active=TRUE', [divisionId])
      if (!divisions.length) return json(res, 400, { error: 'Divisi tidak aktif' })
      const [[adminUser]] = await pool.execute("SELECT id FROM users WHERE role='ADMIN' AND active=TRUE LIMIT 1")
      if (!adminUser) return json(res, 500, { error: 'Tidak ada admin aktif' })
      const lat = b.latitude == null ? null : Number(b.latitude)
      const lng = b.longitude == null ? null : Number(b.longitude)
      if ((lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lng != null && (!Number.isFinite(lng) || lng < -180 || lng > 180))) return json(res, 400, { error: 'Koordinat tidak valid' })
      const urgentDeadline = b.urgentDeadline ? new Date(b.urgentDeadline) : null
      if (!b.scheduledAt) return json(res, 400, { error: 'Tanggal & jam pengerjaan wajib diisi' })
      const scheduledAt = new Date(b.scheduledAt)
      if (Number.isNaN(scheduledAt.getTime()) || (urgentDeadline && Number.isNaN(urgentDeadline.getTime()))) return json(res, 400, { error: 'Tanggal tidak valid' })

      const [conflict] = await pool.execute(
        `SELECT id, title FROM tasks WHERE assignee_id=? AND scheduled_at=? AND status IN ('WAITING','IN_PROGRESS') LIMIT 1`,
        [assigneeId, scheduledAt]
      )
      if (conflict.length) {
        return json(res, 400, { error: `Jam tersebut sudah diambil untuk tugas lain (${conflict[0].title}). Silakan pilih jam/menit yang berbeda.` })
      }
      const guestName = b.guestName.trim().slice(0, 120)
      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()
        const [result] = await conn.execute(
          'INSERT INTO tasks(title,description,priority,urgent_deadline,scheduled_at,creator_id,guest_creator_name,division_id,assignee_id,location_name,address,latitude,longitude,reference_photo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [b.title.trim(), b.description.trim(), b.priority, urgentDeadline, scheduledAt, adminUser.id, guestName, divisionId, assigneeId, b.locationName.trim(), b.address.trim(), lat, lng, b.referencePhoto || null]
        )
        await conn.execute("INSERT INTO task_events(task_id,actor_id,event_type) VALUES(?,?,'TASK_CREATED')", [result.insertId, adminUser.id])
        const [admins] = await conn.query("SELECT id FROM users WHERE role='ADMIN' AND active=TRUE")
        const recipientIds = new Set([assigneeId, ...admins.map(a => Number(a.id))])
        const msg = `Tugas baru dari ${b.guestName.trim()}: ${b.title.trim()}`
        for (const uid of recipientIds) {
          await conn.execute('INSERT INTO notifications(user_id,type,task_id,message) VALUES(?,?,?,?)', [uid, 'TASK_CREATED', result.insertId, msg])
        }
        await conn.commit()
        const task = await getTask(result.insertId)
        broadcast([...recipientIds], 'notification', { type: 'TASK_CREATED', taskId: result.insertId, message: msg })
        broadcast([...recipientIds], 'task_updated', { task })
        return json(res, 201, { ok: true, taskId: Number(result.insertId) })
      } catch (e) { await conn.rollback(); throw e } finally { conn.release() }
    }

    // ── auth ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST' && p === '/api/auth/login') {
      rateLimit(req, 'login', 10, 15 * 60 * 1000)
      const { username, password } = await readBody(req)
      if (typeof username !== 'string' || typeof password !== 'string')
        return json(res, 400, { error: 'Username dan password wajib' })
      const [rows] = await pool.execute(
        'SELECT id,name,username,password_hash,role,division_id divisionId FROM users WHERE username=? AND active=TRUE',
        [username]
      )
      const user = rows[0]
      if (!user || !await verifyPassword(password, user.password_hash))
        return json(res, 401, { error: 'Username atau password salah' })
      if (user.role === 'STAFF') {
        const [[guestRow]] = await pool.query("SELECT val FROM app_settings WHERE setting_key='guest_mode'")
        if (guestRow?.val === 'true') return json(res, 403, { error: 'Staff menggunakan form utama tanpa login' })
      }
      const token = createToken()
      await pool.execute(
        'INSERT INTO sessions(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(CURRENT_TIMESTAMP(3),INTERVAL 12 HOUR))',
        [user.id, hashToken(token)]
      )
      return json(res, 200, {
        user: { id: Number(user.id), name: user.name, username: user.username, role: user.role, divisionId: user.divisionId ? Number(user.divisionId) : null }
      }, { 'set-cookie': cookie(token) })
    }

    if (req.method === 'POST' && p === '/api/auth/logout') {
      const token = bearer(req)
      if (token) await pool.execute('DELETE FROM sessions WHERE token_hash=?', [hashToken(token)])
      return json(res, 200, { ok: true }, { 'set-cookie': cookie('', 0) })
    }

    if (req.method === 'GET' && p === '/api/me') {
      return json(res, 200, { user: await requireUser(req) })
    }

    // ── notifications ────────────────────────────────────────────────────────
    if (req.method === 'GET' && p === '/api/notifications') {
      const user = await requireUser(req)
      const [rows] = await pool.execute(
        `SELECT n.*,t.title task_title FROM notifications n
         JOIN tasks t ON t.id=n.task_id
         WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 50`,
        [user.id]
      )
      return json(res, 200, { notifications: rows.map(r => ({ ...r, id: Number(r.id), taskId: Number(r.task_id), userId: Number(r.user_id) })) })
    }
    if (req.method === 'POST' && p === '/api/notifications/read') {
      const user = await requireUser(req)
      await pool.execute("UPDATE notifications SET read_at=CURRENT_TIMESTAMP(3) WHERE user_id=? AND read_at IS NULL", [user.id])
      return json(res, 200, { ok: true })
    }

    // ── drivers ──────────────────────────────────────────────────────────────
    if (req.method === 'GET' && p === '/api/drivers') {
      const user = await requireUser(req)
      requireRole(user, 'STAFF', 'ADMIN')
      const [rows] = await pool.query(
        `SELECT u.id,u.name,u.username,u.phone,u.active,u.availability_status,d.name division_name,
          EXISTS(SELECT 1 FROM tasks t WHERE t.assignee_id=u.id AND t.status='IN_PROGRESS') on_task
         FROM users u LEFT JOIN divisions d ON d.id=u.division_id
         WHERE u.role='DRIVER'${user.role === 'STAFF' ? " AND u.active=TRUE AND u.availability_status='AVAILABLE'" : ''} ORDER BY u.name`
      )
      return json(res, 200, { drivers: rows.map(x => ({
        id: Number(x.id), name: x.name, username: x.username, phone: x.phone,
        active: Boolean(x.active), division: x.division_name,
        status: !x.active ? 'DISABLED' : x.on_task ? 'ON_TASK' : x.availability_status
      })) })
    }

    if (req.method === 'POST' && p === '/api/drivers') {
      const user = await requireUser(req)
      requireRole(user, 'ADMIN')
      const b = await readBody(req)
      if (!b.name?.trim() || !b.username?.trim() || !b.password)
        return json(res, 400, { error: 'name, username, password wajib' })
      const hash = await hashPassword(b.password)
      const divisionId = b.divisionId ? Number(b.divisionId) : null
      const [result] = await pool.execute(
        "INSERT INTO users(name,username,password_hash,role,division_id,phone) VALUES(?,?,?,'DRIVER',?,?)",
        [b.name.trim(), b.username.trim(), hash, divisionId, b.phone || null]
      )
      return json(res, 201, { driver: { id: Number(result.insertId), name: b.name.trim(), username: b.username.trim(), phone: b.phone || null, active: true, status: 'AVAILABLE' } })
    }

    const driverStatusMatch = p.match(/^\/api\/drivers\/(\d+)\/status$/)
    if (req.method === 'PATCH' && driverStatusMatch) {
      const user = await requireUser(req)
      requireRole(user, 'ADMIN')
      const b = await readBody(req)
      if (!['AVAILABLE', 'ON_LEAVE', 'OFF_DUTY'].includes(b.status)) return json(res, 400, { error: 'Status tidak valid' })
      const driverId = Number(driverStatusMatch[1])
      const [result] = await pool.execute("UPDATE users SET availability_status=? WHERE id=? AND role='DRIVER'", [b.status, driverId])
      if (!result.affectedRows) return json(res, 404, { error: 'Driver tidak ditemukan' })
      return json(res, 200, { id: driverId, status: b.status })
    }

    // ── driver locations (GPS) ────────────────────────────────────────────────
    if (req.method === 'POST' && p === '/api/location') {
      const user = await requireUser(req)
      requireRole(user, 'DRIVER')
      const b = await readBody(req)
      let location
      try { location = parseLocation(b) }
      catch (error) { return json(res, 400, { error: error.message }) }
      const { latitude: lat, longitude: lng, accuracy } = location
      const [active] = await pool.execute(
        "SELECT id FROM tasks WHERE assignee_id=? AND status='IN_PROGRESS' ORDER BY started_at DESC LIMIT 1",
        [user.id]
      )
      if (!active[0]) return json(res, 409, { error: 'Tidak ada tugas aktif' })
      const taskId = Number(active[0].id)
      await pool.execute(
        'INSERT INTO driver_locations(driver_id,task_id,latitude,longitude,accuracy) VALUES(?,?,?,?,?)',
        [user.id, taskId, lat, lng, accuracy]
      )
      await pool.execute(
        `INSERT INTO driver_last_location(driver_id,task_id,latitude,longitude,accuracy,updated_at)
         VALUES(?,?,?,?,?,CURRENT_TIMESTAMP(3))
         ON DUPLICATE KEY UPDATE task_id=VALUES(task_id),latitude=VALUES(latitude),longitude=VALUES(longitude),accuracy=VALUES(accuracy),updated_at=CURRENT_TIMESTAMP(3)`,
        [user.id, taskId, lat, lng, accuracy]
      )
      const [recipients] = await pool.execute(
        `SELECT id FROM users WHERE role='ADMIN' AND active=TRUE
         UNION SELECT creator_id id FROM tasks WHERE id=?`,
        [taskId]
      )
      broadcast(recipients.map(recipient => Number(recipient.id)), 'driver_location', {
        driverId: user.id, driverName: user.name, taskId, latitude: lat, longitude: lng, accuracy, updatedAt: Date.now()
      })
      return json(res, 200, { ok: true })
    }

    if (req.method === 'GET' && p === '/api/activity') {
      const user = await requireUser(req)
      requireRole(user, 'STAFF', 'ADMIN')
      const staffTaskFilter = user.role === 'STAFF' ? ' WHERE t.creator_id=?' : ''
      const taskParams = user.role === 'STAFF' ? [user.id] : []
      const [tasks] = await pool.execute(`${taskSelect}${staffTaskFilter} ORDER BY t.created_at DESC LIMIT 100`, taskParams)
      const staffLocationFilter = user.role === 'STAFF' ? ' AND t.creator_id=?' : ''
      const [locations] = await pool.execute(
        `SELECT dll.*,u.name driver_name FROM driver_last_location dll
         JOIN users u ON u.id=dll.driver_id
         JOIN tasks t ON t.id=dll.task_id
         WHERE dll.updated_at>=DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 2 MINUTE)${staffLocationFilter}`,
        taskParams
      )
      return json(res, 200, {
        tasks: await Promise.all(tasks.map(row => presentTask(rowTask(row)))),
        driverLocations: locations.map(l => ({
          driverId: Number(l.driver_id), driverName: l.driver_name,
          taskId: l.task_id ? Number(l.task_id) : null,
          latitude: Number(l.latitude), longitude: Number(l.longitude),
          accuracy: l.accuracy, updatedAt: new Date(l.updated_at).getTime()
        }))
      })
    }

    // ── tasks ─────────────────────────────────────────────────────────────────
    if (req.method === 'GET' && p === '/api/tasks') {
      const user = await requireUser(req)
      let where = ''; const params = []
      const status = url.searchParams.get('status')
      const priority = url.searchParams.get('priority')
      const driverId = url.searchParams.get('driverId')
      const search = url.searchParams.get('q')
      const conditions = []
      if (user.role === 'STAFF') { conditions.push('t.creator_id=?'); params.push(user.id) }
      else if (user.role === 'DRIVER') { conditions.push('t.assignee_id=?'); params.push(user.id) }
      if (status) { conditions.push('t.status=?'); params.push(status) }
      if (priority) { conditions.push('t.priority=?'); params.push(priority) }
      if (driverId) { conditions.push('t.assignee_id=?'); params.push(Number(driverId)) }
      if (search) { conditions.push('(t.title LIKE ? OR t.description LIKE ?)'); params.push(`%${search}%`, `%${search}%`) }
      if (conditions.length) where = ' WHERE ' + conditions.join(' AND ')
      const [rows] = await pool.execute(
        `${taskSelect}${where} ORDER BY CASE t.status WHEN 'IN_PROGRESS' THEN 0 WHEN 'WAITING' THEN 1 ELSE 2 END,CASE t.priority WHEN 'URGENT' THEN 0 ELSE 1 END,t.created_at ASC`,
        params
      )
      return json(res, 200, { tasks: await Promise.all(rows.map(row => presentTask(rowTask(row)))) })
    }

    if (req.method === 'POST' && p === '/api/tasks') {
      const user = await requireUser(req)
      requireRole(user, 'STAFF', 'ADMIN')
      const b = await readBody(req)
      for (const key of ['title', 'description', 'locationName', 'address'])
        if (typeof b[key] !== 'string' || !b[key].trim())
          return json(res, 400, { error: `${key} wajib diisi` })
      if (!['NORMAL', 'URGENT'].includes(b.priority)) return json(res, 400, { error: 'Priority tidak valid' })
      const assigneeId = Number(b.assigneeId)
      if (!Number.isSafeInteger(assigneeId)) return json(res, 400, { error: 'Driver tidak valid' })
      const [drivers] = await pool.execute("SELECT id FROM users WHERE id=? AND role='DRIVER' AND active=TRUE AND availability_status='AVAILABLE'", [assigneeId])
      if (!drivers.length) return json(res, 400, { error: 'Driver tidak aktif atau sedang libur' })
      const divisionId = user.role === 'STAFF' ? user.divisionId : Number(b.divisionId)
      if (!divisionId) return json(res, 400, { error: 'Division wajib' })
      const lat = b.latitude ? Number(b.latitude) : null
      const lng = b.longitude ? Number(b.longitude) : null
      const urgentDeadline = b.urgentDeadline ? new Date(b.urgentDeadline) : null
      if (!b.scheduledAt) return json(res, 400, { error: 'Tanggal & jam pengerjaan wajib diisi' })
      const scheduledAt = new Date(b.scheduledAt)
      if (Number.isNaN(scheduledAt.getTime()) || (urgentDeadline && Number.isNaN(urgentDeadline.getTime()))) return json(res, 400, { error: 'Tanggal tidak valid' })

      const [conflict] = await pool.execute(
        `SELECT id, title FROM tasks WHERE assignee_id=? AND scheduled_at=? AND status IN ('WAITING','IN_PROGRESS') LIMIT 1`,
        [assigneeId, scheduledAt]
      )
      if (conflict.length) {
        return json(res, 400, { error: `Jam tersebut sudah diambil untuk tugas lain (${conflict[0].title}). Silakan pilih jam/menit yang berbeda.` })
      }
      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()
        const [result] = await conn.execute(
          'INSERT INTO tasks(title,description,priority,urgent_deadline,scheduled_at,creator_id,division_id,assignee_id,location_name,address,latitude,longitude,reference_photo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [b.title.trim(), b.description.trim(), b.priority, urgentDeadline, scheduledAt, user.id, divisionId, assigneeId, b.locationName.trim(), b.address.trim(), lat, lng, b.referencePhoto || null]
        )
        await conn.execute("INSERT INTO task_events(task_id,actor_id,event_type) VALUES(?,?,'TASK_CREATED')", [result.insertId, user.id])
        await conn.commit()
        await notifyTaskEvent(result.insertId, 'TASK_CREATED', user.id)
        return json(res, 201, { task: await presentTask(await getTask(result.insertId)) })
      } catch (e) { await conn.rollback(); throw e } finally { conn.release() }
    }

    // task detail + actions
    const taskMatch = p.match(/^\/api\/tasks\/(\d+)(?:\/(start|complete|cancel))?$/)
    if (taskMatch) {
      const user = await requireUser(req)
      const id = Number(taskMatch[1])
      const task = await getTask(id)
      if (!task) return json(res, 404, { error: 'Task tidak ditemukan' })
      if (!canView(user, task)) return json(res, 403, { error: 'Akses ditolak' })

      if (req.method === 'GET' && !taskMatch[2]) {
        const [events] = await pool.execute(
          `SELECT te.*,u.name actor_name FROM task_events te JOIN users u ON u.id=te.actor_id WHERE te.task_id=? ORDER BY te.created_at ASC`,
          [id]
        )
        return json(res, 200, { task: await presentTask(task), events: events.map(e => ({ ...e, id: Number(e.id), taskId: Number(e.task_id), actorId: Number(e.actor_id) })) })
      }

      if (req.method === 'PATCH' && taskMatch[2]) {
        const action = taskMatch[2]
        const next = { start: 'IN_PROGRESS', complete: 'COMPLETED', cancel: 'CANCELLED' }[action]
        if (!canTransition(user, task, next)) return json(res, 409, { error: 'Transisi status tidak valid' })
        const b = await readBody(req)
        if (action === 'complete' && (!Array.isArray(b.photos) || !b.photos.length))
          return json(res, 400, { error: 'Minimal satu bukti foto wajib' })
        if (action === 'cancel' && (typeof b.reason !== 'string' || !b.reason.trim()))
          return json(res, 400, { error: 'Alasan pembatalan wajib' })
        const compLat = b.latitude ? Number(b.latitude) : null
        const compLng = b.longitude ? Number(b.longitude) : null
        const fields = action === 'start'
          ? ['status=?,started_at=CURRENT_TIMESTAMP(3)', ['IN_PROGRESS']]
          : action === 'complete'
            ? ['status=?,completed_at=CURRENT_TIMESTAMP(3),completion_note=?,completion_photos=?,completion_latitude=?,completion_longitude=?',
              ['COMPLETED', b.note || null, JSON.stringify(b.photos), compLat, compLng]]
            : ['status=?,cancelled_at=CURRENT_TIMESTAMP(3),cancel_reason=?,cancelled_by=?', ['CANCELLED', b.reason.trim(), user.id]]
        const eventType = { start: 'TASK_STARTED', complete: 'TASK_COMPLETED', cancel: 'TASK_CANCELLED' }[action]
        const conn = await pool.getConnection()
        try {
          await conn.beginTransaction()
          const [result] = await conn.execute(`UPDATE tasks SET ${fields[0]} WHERE id=? AND status=?`, [...fields[1], id, task.status])
          if (!result.affectedRows) throw Object.assign(new Error('Status tugas sudah berubah'), { status: 409 })
          if (action === 'complete') await conn.execute('UPDATE driver_last_location SET task_id=NULL WHERE driver_id=? AND task_id=?', [user.id, id])
          await conn.execute('INSERT INTO task_events(task_id,actor_id,event_type,metadata) VALUES(?,?,?,?)', [id, user.id, eventType, JSON.stringify(b)])
          await conn.commit()
          await notifyTaskEvent(id, eventType, user.id)
          return json(res, 200, { task: await presentTask(await getTask(id)) })
        } catch (e) { await conn.rollback(); throw e } finally { conn.release() }
      }
    }

    // task timeline
    const timelineMatch = p.match(/^\/api\/tasks\/(\d+)\/timeline$/)
    if (req.method === 'GET' && timelineMatch) {
      const user = await requireUser(req)
      const id = Number(timelineMatch[1])
      const task = await getTask(id)
      if (!task) return json(res, 404, { error: 'Task tidak ditemukan' })
      if (!canView(user, task)) return json(res, 403, { error: 'Akses ditolak' })
      const [events] = await pool.execute(
        `SELECT te.*,u.name actor_name FROM task_events te JOIN users u ON u.id=te.actor_id WHERE te.task_id=? ORDER BY te.created_at ASC`,
        [id]
      )
      return json(res, 200, { events: events.map(e => ({ ...e, id: Number(e.id), taskId: Number(e.task_id), actorId: Number(e.actor_id) })) })
    }

    // ── upload foto (Google Cloud Storage) ───────────────────────────────────
    if (req.method === 'POST' && (p === '/api/upload' || p === '/api/public/upload')) {
      let owner
      if (p === '/api/public/upload') {
        rateLimit(req, 'guest-upload', 10, 60 * 60 * 1000)
        const [[guestRow]] = await pool.query("SELECT val FROM app_settings WHERE setting_key='guest_mode'")
        if (!guestRow || guestRow.val !== 'true') return json(res, 403, { error: 'Guest mode tidak aktif' })
        owner = 'guest'
      } else {
        const user = await requireUser(req)
        rateLimit(req, 'upload', 30, 60 * 60 * 1000)
        owner = user.id
      }
      if (!gcs || !gcsBucket) return json(res, 503, { error: 'Penyimpanan foto belum dikonfigurasi' })
      const { fileData, photoType } = await readUpload(req)
      if (p === '/api/public/upload' && photoType !== 'REFERENCE') return json(res, 400, { error: 'Guest hanya dapat upload foto referensi' })
      let optimized
      try {
        optimized = await sharp(fileData, { limitInputPixels: 40_000_000, animated: false })
          .rotate()
          .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80, effort: 4 })
          .toBuffer()
      } catch {
        throw Object.assign(new Error('File gambar rusak atau dimensinya terlalu besar'), { status: 400 })
      }
      if (optimized.length > 5_000_000) throw Object.assign(new Error('Hasil gambar terlalu besar'), { status: 413 })
      const key = `${photoType.toLowerCase()}/${owner}/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
      const file = gcsBucket.file(key)
      await file.save(optimized, { contentType: 'image/webp', resumable: false })
      const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 7 * 24 * 60 * 60 * 1000 })
      return json(res, 200, { url: signedUrl, key })
    }

    // ── report ───────────────────────────────────────────────────────────────
    if (req.method === 'GET' && p === '/api/reports/drivers') {
      const user = await requireUser(req)
      requireRole(user, 'ADMIN', 'STAFF')
      const [rows] = await pool.query(
        `SELECT u.id,u.name,
          COUNT(t.id) total,
          SUM(t.status='COMPLETED') completed,
          SUM(t.status='CANCELLED') cancelled,
          SUM(t.status='WAITING') waiting,
          SUM(t.status='IN_PROGRESS') in_progress,
          SUM(CASE WHEN t.status='COMPLETED' THEN TIMESTAMPDIFF(SECOND,t.started_at,t.completed_at) ELSE NULL END) total_seconds,
          AVG(CASE WHEN t.status='COMPLETED' THEN TIMESTAMPDIFF(SECOND,t.started_at,t.completed_at) ELSE NULL END) avg_seconds
         FROM users u
         LEFT JOIN tasks t ON t.assignee_id=u.id
         WHERE u.role='DRIVER'
         GROUP BY u.id,u.name ORDER BY u.name`
      )
      return json(res, 200, { drivers: rows.map(r => ({ ...r, id: Number(r.id), total: Number(r.total), completed: Number(r.completed), cancelled: Number(r.cancelled), waiting: Number(r.waiting), in_progress: Number(r.in_progress), total_seconds: Number(r.total_seconds) || 0, avg_seconds: Math.round(Number(r.avg_seconds)) || 0 })) })
    }

    if (req.method === 'GET' && p === '/api/reports/divisions') {
      const user = await requireUser(req)
      requireRole(user, 'ADMIN', 'STAFF')
      const [rows] = await pool.query(
        `SELECT d.id,d.name,
          COUNT(t.id) total,
          SUM(t.status='COMPLETED') completed,
          SUM(t.status='WAITING') waiting,
          SUM(t.status='IN_PROGRESS') in_progress,
          SUM(t.status='CANCELLED') cancelled
         FROM divisions d
         LEFT JOIN tasks t ON t.division_id=d.id
         WHERE d.active=TRUE
         GROUP BY d.id,d.name ORDER BY d.name`
      )
      return json(res, 200, { divisions: rows.map(r => ({ ...r, id: Number(r.id), total: Number(r.total), completed: Number(r.completed), waiting: Number(r.waiting), in_progress: Number(r.in_progress), cancelled: Number(r.cancelled) })) })
    }

    // ── export Excel driver ───────────────────────────────────────────────────
    if (req.method === 'GET' && p === '/api/export/driver') {
      const user = await requireUser(req)
      requireRole(user, 'DRIVER')

      const url2 = new URL(req.url, `http://${req.headers.host}`)
      const from = url2.searchParams.get('from')
      const to = url2.searchParams.get('to')
      const status = url2.searchParams.get('status')

      let where = 'WHERE t.assignee_id=?'
      const params = [user.id]
      if (status && status !== 'ALL') { where += ' AND t.status=?'; params.push(status) }
      if (from) { where += ' AND t.created_at>=?'; params.push(`${from} 00:00:00`) }
      if (to) { where += ' AND t.created_at<DATE_ADD(?,INTERVAL 1 DAY)'; params.push(`${to} 00:00:00`) }

      const [rows] = await pool.execute(`${taskSelect} ${where} ORDER BY t.created_at DESC`, params)
      const tasks = await Promise.all(rows.map(row => presentTask(rowTask(row))))

      const hDur = (s) => {
        if (!s || s <= 0) return '—'
        const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
        if (d > 0) return `${d} hari ${h} jam ${m} menit`
        if (h > 0) return `${h} jam ${m} menit`
        return m > 0 ? `${m} menit` : '< 1 menit'
      }
      const fmt = (ts) => ts ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts)) : '—'

      const wb = new ExcelJS.Workbook()
      wb.creator = 'TugasGo'; wb.created = new Date()
      const ws = wb.addWorksheet('Laporan Tugas')

      // title
      ws.mergeCells('A1:N1')
      Object.assign(ws.getCell('A1'), { value: `Laporan Tugas — ${user.name}`, font: { bold: true, size: 14 }, alignment: { horizontal: 'center' } })
      ws.mergeCells('A2:N2')
      Object.assign(ws.getCell('A2'), { value: `Diekspor: ${fmt(Date.now())}`, font: { size: 10, color: { argb: 'FF888888' } }, alignment: { horizontal: 'center' } })

      // columns
      ws.columns = [
        { width: 4 }, { width: 26 }, { width: 20 }, { width: 12 }, { width: 10 },
        { width: 20 }, { width: 14 }, { width: 20 }, { width: 20 }, { width: 20 },
        { width: 20 }, { width: 28 }, { width: 14 }, { width: 14 },
      ]

      // header
      const HDR = 4
      const headers = ['No','Judul','Tujuan & Alamat','Divisi','Prioritas','Batas Waktu','Status','Dibuat','Dimulai','Selesai','Durasi','Catatan','Foto Referensi','Foto Bukti']
      const hRow = ws.getRow(HDR)
      hRow.height = 26
      headers.forEach((h, i) => {
        const c = hRow.getCell(i + 1)
        c.value = h
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF176B46' } }
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      })

      // data
      tasks.forEach((t, i) => {
        const bg = i % 2 === 0 ? 'FFFAFCFA' : 'FFFFFFFF'
        const sColor = t.status === 'COMPLETED' ? 'FF176B46' : t.status === 'CANCELLED' ? 'FFC0392B' : t.status === 'IN_PROGRESS' ? 'FF1D6FA0' : 'FF888888'
        const row = ws.addRow([])
        row.height = 20

        const set = (col, val, opts = {}) => {
          const c = row.getCell(col)
          c.value = val
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
          c.alignment = { vertical: 'middle', wrapText: true, ...opts }
          c.border = { bottom: { style: 'hair', color: { argb: 'FFDDE3DE' } } }
          return c
        }

        set(1, i + 1, { horizontal: 'center' }).font = { size: 10 }
        set(2, t.title).font = { bold: true, size: 11 }
        set(3, t.destination + (t.address ? '\n' + t.address : '')).font = { size: 10 }
        set(4, t.division, { horizontal: 'center' }).font = { size: 10 }
        set(5, t.priority, { horizontal: 'center' }).font = { bold: true, size: 10, color: { argb: t.priority === 'URGENT' ? 'FFC0392B' : 'FF555555' } }

        // kolom 6 — batas waktu URGENT
        if (t.priority === 'URGENT' && t.urgentDeadline) {
          const isOver = !['COMPLETED','CANCELLED'].includes(t.status) && Date.now() > t.urgentDeadline
          const dlCell = set(6, fmt(t.urgentDeadline), { horizontal: 'center' })
          dlCell.font = { size: 10, bold: isOver, color: { argb: isOver ? 'FFC0392B' : 'FFB45309' } }
          if (isOver) dlCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0EE' } }
        } else {
          set(6, '—', { horizontal: 'center' }).font = { size: 10, color: { argb: 'FFCCCCCC' } }
        }

        set(7, ({ WAITING: 'Menunggu', IN_PROGRESS: 'Berjalan', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan' })[t.status] || t.status, { horizontal: 'center' }).font = { bold: true, size: 10, color: { argb: sColor } }
        set(8, fmt(t.created), { horizontal: 'center' }).font = { size: 10 }
        set(9, fmt(t.startedAt), { horizontal: 'center' }).font = { size: 10 }
        set(10, fmt(t.completedAt || t.cancelledAt), { horizontal: 'center' }).font = { size: 10 }
        set(11, hDur(t.durationSeconds), { horizontal: 'center' }).font = { size: 10 }
        set(12, [t.note && `Catatan: ${t.note}`, t.cancelReason && `Alasan batal: ${t.cancelReason}`].filter(Boolean).join('\n') || '—').font = { size: 10 }

        // foto referensi — hyperlink
        const refCell = set(13, t.referencePhoto ? 'Lihat foto ↗' : '—', { horizontal: 'center' })
        if (t.referencePhoto?.startsWith('http')) {
          refCell.value = { text: 'Lihat foto', hyperlink: t.referencePhoto }
          refCell.font = { size: 10, color: { argb: 'FF1D6FA0' }, underline: true }
        } else { refCell.font = { size: 10, color: { argb: 'FF888888' } } }

        // foto bukti — hyperlink semua
        const photos = (t.photos || []).filter(p => typeof p === 'string' && p.startsWith('http'))
        const buktiCell = set(14, photos.length > 0 ? `${photos.length} foto` : '—', { horizontal: 'center' })
        if (photos.length === 1) {
          buktiCell.value = { text: '1 foto ↗', hyperlink: photos[0] }
          buktiCell.font = { size: 10, color: { argb: 'FF1D6FA0' }, underline: true }
        } else if (photos.length > 1) {
          buktiCell.value = `${photos.length} foto`
          buktiCell.font = { size: 10, color: { argb: 'FF1D6FA0' } }
          buktiCell.note = photos.map((p, idx) => `Foto ${idx+1}: ${p}`).join('\n')
        } else { buktiCell.font = { size: 10, color: { argb: 'FF888888' } } }

        row.commit()
      })

      ws.views = [{ state: 'frozen', xSplit: 0, ySplit: HDR, activeCell: `A${HDR + 1}` }]
      ws.autoFilter = { from: { row: HDR, column: 1 }, to: { row: HDR, column: headers.length } }

      const fname = `laporan-${user.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.xlsx`
      const buf = await wb.xlsx.writeBuffer()
      res.writeHead(200, {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${fname}"`,
        'content-length': buf.byteLength,
        'access-control-allow-origin': origin || allowedOrigin,
        'access-control-allow-credentials': 'true',
      })
      return res.end(buf)
    }

    // ── admin: user management ────────────────────────────────────────────────
    if (req.method === 'GET' && p === '/api/admin/users') {
      const user = await requireUser(req)
      requireRole(user, 'ADMIN')
      const [rows] = await pool.query(
        `SELECT u.id,u.name,u.username,u.role,u.phone,u.active,u.availability_status,u.created_at,d.name division_name
         FROM users u LEFT JOIN divisions d ON d.id=u.division_id ORDER BY u.role,u.name`
      )
      return json(res, 200, { users: rows.map(r => ({ ...r, id: Number(r.id) })) })
    }

    if (req.method === 'POST' && p === '/api/admin/users') {
      const user = await requireUser(req)
      requireRole(user, 'ADMIN')
      const b = await readBody(req)
      if (!b.name?.trim() || !b.username?.trim() || !b.password || !b.role)
        return json(res, 400, { error: 'name, username, password, role wajib' })
      if (!['ADMIN', 'STAFF', 'DRIVER'].includes(b.role)) return json(res, 400, { error: 'Role tidak valid' })
      const hash = await hashPassword(b.password)
      const divisionId = b.divisionId ? Number(b.divisionId) : null
      const [result] = await pool.execute(
        'INSERT INTO users(name,username,password_hash,role,division_id,phone) VALUES(?,?,?,?,?,?)',
        [b.name.trim(), b.username.trim(), hash, b.role, divisionId, b.phone || null]
      )
      return json(res, 201, { id: Number(result.insertId) })
    }

    const userMatch = p.match(/^\/api\/admin\/users\/(\d+)$/)
    if (userMatch) {
      const user = await requireUser(req)
      requireRole(user, 'ADMIN')
      const targetId = Number(userMatch[1])
      if (req.method === 'PATCH') {
        const b = await readBody(req)
        const sets = []; const params = []
        if (b.name) { sets.push('name=?'); params.push(b.name.trim()) }
        if (b.phone !== undefined) { sets.push('phone=?'); params.push(b.phone || null) }
        if (typeof b.active === 'boolean') { sets.push('active=?'); params.push(b.active) }
        if (b.divisionId !== undefined) { sets.push('division_id=?'); params.push(b.divisionId ? Number(b.divisionId) : null) }
        if (b.password) { sets.push('password_hash=?'); params.push(await hashPassword(b.password)) }
        if (!sets.length) return json(res, 400, { error: 'Tidak ada data yang diubah' })
        params.push(targetId)
        await pool.execute(`UPDATE users SET ${sets.join(',')} WHERE id=?`, params)
        return json(res, 200, { ok: true })
      }
      if (req.method === 'DELETE') {
        if (targetId === user.id) return json(res, 400, { error: 'Akun yang sedang digunakan tidak dapat dihapus' })
        const [[target]] = await pool.execute('SELECT role FROM users WHERE id=?', [targetId])
        if (!target) return json(res, 404, { error: 'Pengguna tidak ditemukan' })
        if (target.role === 'ADMIN') {
          const [[adminCount]] = await pool.query("SELECT COUNT(*) total FROM users WHERE role='ADMIN' AND active=TRUE")
          if (Number(adminCount.total) <= 1) return json(res, 400, { error: 'Admin aktif terakhir tidak dapat dihapus' })
        }
        const conn = await pool.getConnection()
        try {
          await conn.beginTransaction()
          await conn.execute('DELETE n FROM notifications n JOIN tasks t ON t.id=n.task_id WHERE t.creator_id=? OR t.assignee_id=?', [targetId, targetId])
          await conn.execute('DELETE te FROM task_events te JOIN tasks t ON t.id=te.task_id WHERE t.creator_id=? OR t.assignee_id=?', [targetId, targetId])
          await conn.execute('DELETE dl FROM driver_locations dl JOIN tasks t ON t.id=dl.task_id WHERE t.creator_id=? OR t.assignee_id=?', [targetId, targetId])
          await conn.execute('UPDATE driver_last_location dll JOIN tasks t ON t.id=dll.task_id SET dll.task_id=NULL WHERE t.creator_id=? OR t.assignee_id=?', [targetId, targetId])
          await conn.execute('DELETE FROM tasks WHERE creator_id=? OR assignee_id=?', [targetId, targetId])
          await conn.execute('UPDATE tasks SET cancelled_by=NULL WHERE cancelled_by=?', [targetId])
          await conn.execute('DELETE FROM task_events WHERE actor_id=?', [targetId])
          await conn.execute('DELETE FROM notifications WHERE user_id=?', [targetId])
          await conn.execute('DELETE FROM driver_locations WHERE driver_id=?', [targetId])
          await conn.execute('DELETE FROM driver_last_location WHERE driver_id=?', [targetId])
          await conn.execute('DELETE FROM sessions WHERE user_id=?', [targetId])
          await conn.execute('DELETE FROM users WHERE id=?', [targetId])
          await conn.commit()
          return json(res, 200, { ok: true })
        } catch (e) { await conn.rollback(); throw e } finally { conn.release() }
      }
    }

    // ── admin: division management ────────────────────────────────────────────
    if (req.method === 'GET' && p === '/api/admin/divisions') {
      const user = await requireUser(req)
      requireRole(user, 'ADMIN', 'STAFF', 'DRIVER')
      const [rows] = await pool.query('SELECT * FROM divisions ORDER BY name')
      return json(res, 200, { divisions: rows.map(r => ({ ...r, id: Number(r.id) })) })
    }

    if (req.method === 'POST' && p === '/api/admin/divisions') {
      const user = await requireUser(req)
      requireRole(user, 'ADMIN')
      const b = await readBody(req)
      if (!b.name?.trim()) return json(res, 400, { error: 'Nama divisi wajib' })
      const [result] = await pool.execute('INSERT INTO divisions(name) VALUES(?)', [b.name.trim()])
      return json(res, 201, { id: Number(result.insertId) })
    }

    const divMatch = p.match(/^\/api\/admin\/divisions\/(\d+)$/)
    if (divMatch) {
      const user = await requireUser(req)
      requireRole(user, 'ADMIN')
      const divId = Number(divMatch[1])
      if (req.method === 'PATCH') {
        const b = await readBody(req)
        const sets = []; const params = []
        if (b.name) { sets.push('name=?'); params.push(b.name.trim()) }
        if (typeof b.active === 'boolean') { sets.push('active=?'); params.push(b.active) }
        if (!sets.length) return json(res, 400, { error: 'Tidak ada data yang diubah' })
        params.push(divId)
        await pool.execute(`UPDATE divisions SET ${sets.join(',')} WHERE id=?`, params)
        return json(res, 200, { ok: true })
      }
      if (req.method === 'DELETE') {
        const conn = await pool.getConnection()
        try {
          await conn.beginTransaction()
          const [[division]] = await conn.execute('SELECT id FROM divisions WHERE id=? FOR UPDATE', [divId])
          if (!division) { await conn.rollback(); return json(res, 404, { error: 'Divisi tidak ditemukan' }) }
          await conn.execute('DELETE n FROM notifications n JOIN tasks t ON t.id=n.task_id WHERE t.division_id=?', [divId])
          await conn.execute('DELETE te FROM task_events te JOIN tasks t ON t.id=te.task_id WHERE t.division_id=?', [divId])
          await conn.execute('DELETE dl FROM driver_locations dl JOIN tasks t ON t.id=dl.task_id WHERE t.division_id=?', [divId])
          await conn.execute('UPDATE driver_last_location dll JOIN tasks t ON t.id=dll.task_id SET dll.task_id=NULL WHERE t.division_id=?', [divId])
          await conn.execute('DELETE FROM tasks WHERE division_id=?', [divId])
          await conn.execute('UPDATE users SET division_id=NULL WHERE division_id=?', [divId])
          await conn.execute('DELETE FROM divisions WHERE id=?', [divId])
          await conn.commit()
          return json(res, 200, { ok: true })
        } catch (e) { await conn.rollback(); throw e } finally { conn.release() }
      }
    }

    return json(res, 404, { error: 'Endpoint tidak ditemukan' })
  } catch (error) {
    console.error(error)
    return json(res, error.status || 500, { error: error.status ? error.message : 'Terjadi kesalahan server' })
  }
}

// ─── Server + WebSocket ───────────────────────────────────────────────────────

async function syncAttendance() {
  const baseUrl = process.env.ATTENDANCE_API_URL?.replace(/\/$/, '')
  const apiKey = process.env.ATTENDANCE_API_KEY
  if (!baseUrl || !apiKey) return
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE || 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts().map(part => [part.type, part.value]))
  const currentHour = Number(parts.hour)
  const date = `${parts.year}-${parts.month}-${parts.day}`
  const [[lock]] = await pool.query("SELECT GET_LOCK('tugasgo-attendance-sync',0) acquired")
  if (!lock?.acquired) return
  try {
    const scansByName = new Map()
    let sourceSync = null
    let offset = 0
    while (true) {
      const url = new URL(`${baseUrl}/api/v1/attendance`)
      url.searchParams.set('tanggal_awal', date)
      url.searchParams.set('tanggal_akhir', date)
      url.searchParams.set('limit', '5000')
      url.searchParams.set('offset', String(offset))
      const response = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) })
      if (!response.ok) throw new Error(`Attendance API ${response.status}`)
      const body = await response.json()
      if (!body.berhasil || !Array.isArray(body.data)) throw new Error('Respons attendance tidak valid')
      sourceSync = body.meta?.last_sync || sourceSync
      for (const scan of body.data) {
        if (!scan.nama || typeof scan.waktu !== 'string') continue
        const name = normalizeName(scan.nama)
        if (!scansByName.has(name)) scansByName.set(name, [])
        scansByName.get(name).push(scan.waktu.slice(11, 19))
      }
      offset += body.data.length
      if (!body.data.length || offset >= Number(body.meta?.total || 0)) break
    }
    const [drivers] = await pool.query("SELECT id,name FROM users WHERE role='DRIVER' AND active=TRUE")
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      for (const driver of drivers) await conn.execute('UPDATE users SET availability_status=? WHERE id=?', [attendanceStatus(driver.name, scansByName, currentHour), driver.id])
      await conn.execute("INSERT INTO app_settings(setting_key,val) VALUES('attendance_last_sync_date',?) ON DUPLICATE KEY UPDATE val=VALUES(val)", [date])
      if (sourceSync) await conn.execute("INSERT INTO app_settings(setting_key,val) VALUES('attendance_last_source_sync',?) ON DUPLICATE KEY UPDATE val=VALUES(val)", [sourceSync])
      await conn.commit()
    } catch (error) { await conn.rollback(); throw error } finally { conn.release() }
  } finally {
    await pool.query("SELECT RELEASE_LOCK('tugasgo-attendance-sync')")
  }
}

if (process.env.NODE_ENV !== 'test') {
  const cleanupLocations = () => pool.execute("DELETE FROM driver_locations WHERE recorded_at<DATE_SUB(CURRENT_TIMESTAMP(3),INTERVAL 30 DAY)").catch(error => console.error('Cleanup lokasi gagal:', error.message))
  cleanupLocations()
  const cleanupTimer = setInterval(cleanupLocations, 24 * 60 * 60 * 1000)
  cleanupTimer.unref()
  const runAttendanceSync = () => syncAttendance().catch(error => console.error('Sinkron absensi gagal:', error.message))
  runAttendanceSync()
  const attendanceTimer = setInterval(runAttendanceSync, 5 * 60 * 1000)
  attendanceTimer.unref()
  const server = createServer(handler)
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    verifyClient: ({ origin }, done) => done(isAllowedOrigin(origin), isAllowedOrigin(origin) ? 200 : 403, isAllowedOrigin(origin) ? undefined : 'Origin tidak diizinkan'),
  })

  wss.on('connection', async (ws, req) => {
    let userId = null
    try {
      const user = await auth(req)
      if (!user) return ws.close(1008, 'Autentikasi diperlukan')
      userId = user.id
      if (!clients.has(userId)) clients.set(userId, new Set())
      clients.get(userId).add(ws)
      ws.send(JSON.stringify({ event: 'authenticated', data: { userId } }))
    } catch {
      return ws.close(1011, 'Autentikasi gagal')
    }
    ws.on('close', () => {
      if (userId) {
        const sockets = clients.get(userId)
        if (sockets) { sockets.delete(ws); if (!sockets.size) clients.delete(userId) }
      }
    })
  })

  server.listen(port, '0.0.0.0', () => console.log(`TugasGo API :${port}`))
}

export { pool }
