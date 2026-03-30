import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'

import { createApp, initSchema, requireDate, requireMonth } from './index.js'

test('rejects invalid household payloads', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvstat-test-'))
  const dbPath = path.join(tmpDir, 'test.db')
  const svc = createApp({ dbPath })

  try {
    assert.throws(() => requireDate('2026-02-30', '日期'), /YYYY-MM-DD/)
    assert.equal(requireDate('2026-02-28', '日期'), '2026-02-28')
  } finally {
    svc.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('rejects invalid month query', async () => {
  assert.throws(() => requireMonth('2026-13'), /YYYY-MM/)
  assert.equal(requireMonth('2026-03'), '2026-03')
})

test('deleting a household also removes generation rows', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvstat-test-'))
  const dbPath = path.join(tmpDir, 'test.db')
  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  initSchema(db)

  try {
    const insertHousehold = db.prepare(`
      INSERT INTO households (name, capacity_kw, price_per_kwh)
      VALUES (?, ?, ?)
    `)
    const insertGeneration = db.prepare(`
      INSERT INTO generation (household_id, date, kwh)
      VALUES (?, ?, ?)
    `)
    const countGeneration = db.prepare('SELECT COUNT(*) AS count FROM generation')

    const result = insertHousehold.run('张三', 12.5, 0.98)
    insertGeneration.run(result.lastInsertRowid, '2026-03-15', 23.6)

    assert.equal(countGeneration.get().count, 1)

    db.prepare('DELETE FROM households WHERE id = ?').run(result.lastInsertRowid)

    assert.equal(countGeneration.get().count, 0)
  } finally {
    db.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
