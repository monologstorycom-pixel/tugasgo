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

test('staff location visibility follows task ownership', () => {
  assert.match(app, /user\.role === 'STAFF' \? ' AND t\.creator_id=\?' : ''/)
  assert.match(app, /UNION SELECT creator_id id FROM tasks WHERE id=\?/)
  assert.doesNotMatch(app, /role IN \('ADMIN','STAFF'\).*driver_location/s)
})

test('browser tracking reports poor accuracy and uses continuous location updates', () => {
  assert.match(hooks, /watchPosition/)
  assert.match(hooks, /accuracy > 100 \? 'warning' : 'active'/)
  assert.match(hooks, /clearWatch/)
})
