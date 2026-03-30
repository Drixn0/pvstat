import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'

import { createApp, initSchema, requireDate, requireMonth } from './index.js'

async function invokeApp(app, req) {
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
    app.handle(req, res, (error) => {
      if (error) reject(error)
      else resolve()
    })
    if (res.body) resolve()
  })

  return res
}

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

test('schema creates indexes for household and generation lookups', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvstat-test-'))
  const dbPath = path.join(tmpDir, 'test.db')
  const db = new Database(dbPath)
  initSchema(db)

  try {
    const indexes = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'index'
      ORDER BY name ASC
    `).all().map((row) => row.name)

    assert.deepEqual(indexes, [
      'idx_generation_date',
      'idx_generation_household_date',
      'idx_households_name',
      'sqlite_autoindex_generation_1'
    ])
  } finally {
    db.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
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

test('batch deleting households removes all requested rows', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvstat-test-'))
  const dbPath = path.join(tmpDir, 'test.db')
  const svc = createApp({ dbPath })

  try {
    const insertHousehold = svc.db.prepare(`
      INSERT INTO households (name, capacity_kw, price_per_kwh)
      VALUES (?, ?, ?)
    `)
    const first = insertHousehold.run('甲', 10, 1)
    const second = insertHousehold.run('乙', 12, 1.1)

    const loginRes = await invokeApp(svc.app, {
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      body: { username: 'admin', password: 'changeme123' }
    })
    const token = loginRes.body.token

    const res = await invokeApp(svc.app, {
      method: 'POST',
      url: '/households/batch-delete',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`
      },
      body: { ids: [first.lastInsertRowid, second.lastInsertRowid] }
    })

    const count = svc.db.prepare('SELECT COUNT(*) AS count FROM households').get().count
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.deletedCount, 2)
    assert.equal(count, 0)
  } finally {
    svc.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('protected write endpoints require login', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvstat-test-'))
  const dbPath = path.join(tmpDir, 'test.db')
  const svc = createApp({ dbPath })

  try {
    const res = await invokeApp(svc.app, {
      method: 'POST',
      url: '/households',
      headers: { 'content-type': 'application/json' },
      body: {
        name: '未授权用户',
        capacity_kw: 10,
        price_per_kwh: 1
      }
    })

    assert.equal(res.statusCode, 401)
    assert.match(res.body.error, /未登录|登录/)
  } finally {
    svc.close()
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

test('household history summary aggregates monthly generation', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvstat-test-'))
  const dbPath = path.join(tmpDir, 'test.db')
  const svc = createApp({ dbPath })

  try {
    svc.db.prepare(`
      INSERT INTO households (name, capacity_kw, price_per_kwh)
      VALUES (?, ?, ?)
    `).run('李四', 8.8, 1.2)

    const householdId = svc.db.prepare('SELECT id FROM households WHERE name = ?').get('李四').id
    const insertGeneration = svc.db.prepare(`
      INSERT INTO generation (household_id, date, kwh)
      VALUES (?, ?, ?)
    `)

    insertGeneration.run(householdId, '2026-01-02', 10)
    insertGeneration.run(householdId, '2026-01-03', 14)
    insertGeneration.run(householdId, '2026-02-10', 20)

    const req = { method: 'GET', url: `/households/${householdId}/history-summary`, headers: {}, params: { id: String(householdId) } }
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
    assert.equal(res.body.household.name, '李四')
    assert.equal(res.body.totals.months, 2)
    assert.equal(res.body.totals.totalKwh, 44)
    assert.equal(res.body.totals.estimatedAmount, 52.8)
    assert.equal(res.body.months[0].month, '2026-02')
    assert.equal(res.body.months[0].filledDays, 1)
    assert.equal(res.body.months[1].month, '2026-01')
    assert.equal(res.body.months[1].totalKwh, 24)
  } finally {
    svc.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

test('monthly generation summary returns aggregate stats', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pvstat-test-'))
  const dbPath = path.join(tmpDir, 'test.db')
  const svc = createApp({ dbPath })

  try {
    const insertHousehold = svc.db.prepare(`
      INSERT INTO households (name, capacity_kw, price_per_kwh)
      VALUES (?, ?, ?)
    `)
    const first = insertHousehold.run('甲', 10, 1)
    const second = insertHousehold.run('乙', 5, 2)
    const insertGeneration = svc.db.prepare(`
      INSERT INTO generation (household_id, date, kwh)
      VALUES (?, ?, ?)
    `)

    insertGeneration.run(first.lastInsertRowid, '2026-03-01', 10)
    insertGeneration.run(first.lastInsertRowid, '2026-03-02', 20)
    insertGeneration.run(second.lastInsertRowid, '2026-03-02', 5)
    insertGeneration.run(second.lastInsertRowid, '2026-04-01', 99)

    const req = {
      method: 'GET',
      url: '/generation/summary?month=2026-03',
      headers: {},
      query: { month: '2026-03' }
    }
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
    assert.equal(res.body.householdCount, 2)
    assert.equal(res.body.totalCapacityKw, 15)
    assert.equal(res.body.grandTotals.kwh, 35)
    assert.equal(res.body.grandTotals.amount, 40)
    assert.equal(res.body.userStats[0].monthEqHours, 3)
    assert.equal(res.body.userStats[1].monthTotalAmount, 10)
    assert.equal(res.body.dailyTotals[1].day, '02')
    assert.equal(res.body.dailyTotals[1].amount, 30)
  } finally {
    svc.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
