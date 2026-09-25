import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('./app.mjs', import.meta.url), 'utf8')
const hooks = await readFile(new URL('../src/lib/hooks.ts', import.meta.url), 'utf8')

test('GPS tracking requires active task and rejects stale locations', () => {
  assert.match(app, /if \(!active\[0\]\) return json\(res, 409, \{ error: 'Tidak ada tugas aktif' \}\)/)
  assert.match(app, /dll\.updated_at>=DATE_SUB\(CURRENT_TIMESTAMP\(3\),INTERVAL 2 MINUTE\)/)
  assert.match(app, /recorded_at<DATE_SUB\(CURRENT_TIMESTAMP\(3\),INTERVAL 30 DAY\)/)
})

test('staff and admin see active driver locations', () => {
  assert.match(app, /role IN \('ADMIN', 'STAFF'\)/)
  assert.match(app, /LEFT JOIN tasks t ON t\.id=dll\.task_id/)
})

test('photo uploads persist stable keys and API responses refresh signed URLs', () => {
  assert.match(app, /return json\(res, 200, \{ url: signedUrl, key \}\)/)
  assert.match(app, /const presentTask = async task/)
  assert.match(app, /referencePhoto: await photoUrl\(task\.referencePhoto\)/)
})

test('browser tracking reports poor accuracy and uses continuous location updates', () => {
  assert.match(hooks, /watchPosition/)
  assert.match(hooks, /accuracy > 100 \? 'warning' : 'active'/)
  assert.match(hooks, /clearWatch/)
})
