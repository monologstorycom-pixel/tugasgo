import test from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword, createToken, hashToken, canTransition, visibleTasks } from './domain.mjs'

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

test('task visibility follows role ownership', () => {
  const tasks = [
    { id:1, creatorId:10, assigneeId:7 },
    { id:2, creatorId:11, assigneeId:8 },
  ]
  assert.deepEqual(visibleTasks({ id:10, role:'STAFF' }, tasks).map(t=>t.id), [1])
  assert.deepEqual(visibleTasks({ id:7, role:'DRIVER' }, tasks).map(t=>t.id), [1])
  assert.deepEqual(visibleTasks({ id:99, role:'ADMIN' }, tasks).map(t=>t.id), [1,2])
})
