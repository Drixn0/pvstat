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

test('health endpoint reflects runtime config options', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvstat-test-'))
  const dbPath = path.join(tmpDir, 'test.db')
  const svc = createApp({
    dbPath,
    allowedOrigin: 'http://example.com',
    enableDbHealthcheck: false,
    jsonBodyLimit: '128kb',
    dbBusyTimeoutMs: 1500,
    dbJournalMode: 'WAL'
  })

  try {
    const req = { method: 'GET', url: '/health', headers: {} }
    const res = {
      statusCode: 200,
      headers: {},
      body: '',
      setHeader(name, value) {
        this.headers[name] = value
      },
      getHeader(name) {
        return this.headers[name]
      },
      status(code) {
        this.statusCode = code
        return this
      },
      json(payload) {
        this.body = payload
        return this
      }
    }

    await new Promise((resolve, reject) => {
      svc.app.handle(req, res, (error) => {
        if (error) reject(error)
        else resolve()
      })
      if (res.body) resolve()
    })

    assert.equal(res.statusCode, 200)
    assert.equal(res.body.status, 'ok')
    assert.equal(res.body.config.dbHealthcheck, false)
    assert.equal(res.body.config.allowedOrigin, 'http://example.com')
    assert.equal(res.body.config.jsonBodyLimit, '128kb')
    assert.equal(res.body.config.dbBusyTimeoutMs, 1500)
    assert.equal(res.body.config.dbJournalMode, 'WAL')
  } finally {
    svc.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
