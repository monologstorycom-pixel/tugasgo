import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('./app.mjs', import.meta.url), 'utf8')
const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')

test('native push notification schema and endpoints exist', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS user_devices/)
  assert.match(schema, /token VARCHAR\(255\) NOT NULL UNIQUE/)
  assert.match(schema, /platform ENUM\('ANDROID','IOS','WEB'\)/)
  assert.match(app, /\/api\/device\/push-token/)
  assert.match(app, /sendPushNotification/)
})

test('batch GPS upload endpoint exists for offline buffer sync', () => {
  assert.match(app, /\/api\/locations\/batch/)
  assert.match(app, /INSERT INTO driver_locations/)
})

test('direct presigned upload endpoint exists for native fast uploads', () => {
  assert.match(app, /\/api\/uploads\/request-url/)
  assert.match(app, /action: 'write'/)
})

test('app version check endpoint exists for force update policy', () => {
  assert.match(app, /\/api\/app\/version/)
  assert.match(app, /minVersion/)
  assert.match(app, /latestVersion/)
})
