import test from 'node:test'
import assert from 'node:assert/strict'
import { attendanceStatus, hashPassword, verifyPassword, createToken, hashToken, canTransition, normalizeName, parseLocation, visibleTasks } from './domain.mjs'

test('password hash verifies without storing plaintext', async () => {
  const stored = await hashPassword('123456')
  assert.equal(stored.includes('123456'), false)
  assert.equal(await verifyPassword('123456', stored), true)
  assert.equal(await verifyPassword('salah', stored), false)
  await assert.rejects(hashPassword('12345'), /Password minimal 6 karakter/)
})

test('session token is random and only its digest is persisted', () => {
  const token = createToken()
  assert.match(token, /^[a-f0-9]{64}$/)
  assert.equal(hashToken(token).length, 64)
  assert.notEqual(hashToken(token), token)
})

test('only assigned driver can perform valid task transitions', () => {
  const task = { status:'WAITING', assigneeId:7 }
  assert.equal(canTransition({ id:7, role:'DRIVER' }, task, 'IN_PROGRESS'), true)
  assert.equal(canTransition({ id:8, role:'DRIVER' }, task, 'IN_PROGRESS'), false)
  assert.equal(canTransition({ id:7, role:'STAFF' }, task, 'IN_PROGRESS'), false)
  assert.equal(canTransition({ id:7, role:'DRIVER' }, task, 'COMPLETED'), false)
  assert.equal(canTransition({ id:7, role:'DRIVER' }, { ...task, status:'IN_PROGRESS' }, 'COMPLETED'), true)
  assert.equal(canTransition({ id:7, role:'DRIVER' }, task, 'CANCELLED'), true)
})

test('location validation enforces geographic ranges and accuracy', () => {
  assert.deepEqual(parseLocation({ latitude: '-7.25', longitude: '112.75', accuracy: '12' }), { latitude: -7.25, longitude: 112.75, accuracy: 12 })
  assert.throws(() => parseLocation({ latitude: 91, longitude: 0 }), /Latitude tidak valid/)
  assert.throws(() => parseLocation({ latitude: 0, longitude: -181 }), /Longitude tidak valid/)
  assert.throws(() => parseLocation({ latitude: 0, longitude: 0, accuracy: -1 }), /Akurasi tidak valid/)
})

test('attendance matches names and marks scans after 16:30 as off duty', () => {
  const scans = new Map([
    [normalizeName('Aditya  Sandi Jentera'), ['08:12:00']],
    [normalizeName('Driver Pulang'), ['08:05:00', '16:31:00']],
  ])
  assert.equal(attendanceStatus(' aditya sandi jentera ', scans, 8), 'AVAILABLE')
  assert.equal(attendanceStatus('Driver Pulang', scans, 17), 'OFF_DUTY')
  assert.equal(attendanceStatus('Driver Belum Scan Pagi', scans, 8), 'AVAILABLE')
  assert.equal(attendanceStatus('Driver Tidak Hadir', scans, 11), 'ON_LEAVE')
})

test('task visibility follows role ownership', () => {
  const tasks = [
    { id:1, creatorId:10, assigneeId:7 },
    { id:2, creatorId:11, assigneeId:8 },
  ]
  assert.deepEqual(visibleTasks({ id:10, role:'STAFF' }, tasks).map(t=>t.id), [1])
  assert.deepEqual(visibleTasks({ id:7, role:'DRIVER' }, tasks).map(t=>t.id), [1])
  assert.deepEqual(visibleTasks({ id:99, role:'ADMIN' }, tasks).map(t=>t.id), [1,2])
})
