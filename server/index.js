import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'

const APP_VERSION = process.env.APP_VERSION || '2.0.0'
const DEFAULT_JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '256kb'
const DEFAULT_DB_BUSY_TIMEOUT_MS = Number(process.env.DB_BUSY_TIMEOUT_MS || 5000)
const DEFAULT_DB_JOURNAL_MODE = process.env.DB_JOURNAL_MODE || 'WAL'

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function route(handler) {
  return (req, res, next) => {
    try {
      handler(req, res, next)
    } catch (error) {
      next(error)
    }
  }
}

function requireNonEmptyString(value, fieldName) {
  const text = String(value ?? '').trim()
  if (!text) {
    throw new HttpError(400, `${fieldName}不能为空`)
  }
  return text
}

function requireNonNegativeNumber(value, fieldName) {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) {
    throw new HttpError(400, `${fieldName}必须是大于等于0的数字`)
  }
  return num
}

function requirePositiveInt(value, fieldName) {
  const num = Number(value)
  if (!Number.isInteger(num) || num <= 0) {
    throw new HttpError(400, `${fieldName}必须是正整数`)
  }
  return num
}

export function requireMonth(value) {
  const month = String(value ?? '')
  if (!/^\d{4}-\d{2}$/.test(month) || !monthIsValid(month)) {
    throw new HttpError(400, 'month格式必须为YYYY-MM')
  }
  return month
}

export function requireDate(value, fieldName) {
  const date = String(value ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !dateIsValid(date)) {
    throw new HttpError(400, `${fieldName}格式必须为YYYY-MM-DD`)
  }
  return date
}

function monthIsValid(month) {
  const [year, mon] = month.split('-').map(Number)
  return year >= 2000 && mon >= 1 && mon <= 12
}

function dateIsValid(date) {
  const parsed = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
}

function normalizeBoolean(value, defaultValue = false) {
  if (value == null || value === '') return defaultValue
  return String(value).toLowerCase() !== 'false'
}

function normalizePositiveNumber(value, defaultValue) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return defaultValue
  return num
}

export function initSchema(db) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS households (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    capacity_kw REAL,
    price_per_kwh REAL
  );

  CREATE TABLE IF NOT EXISTS generation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    household_id INTEGER,
    date TEXT,
    kwh REAL,
    FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
    UNIQUE(household_id, date)
  );
  `)
}

export function createApp(options = {}) {
  const dbPath = options.dbPath ?? process.env.DB_PATH ?? 'pv.db'
  const allowedOrigin = options.allowedOrigin ?? process.env.ALLOWED_ORIGIN ?? '*'
  const enableDbHealthcheck = normalizeBoolean(options.enableDbHealthcheck ?? process.env.HEALTHCHECK_DB, true)
  const jsonBodyLimit = options.jsonBodyLimit ?? DEFAULT_JSON_BODY_LIMIT
  const dbBusyTimeoutMs = normalizePositiveNumber(
    options.dbBusyTimeoutMs ?? process.env.DB_BUSY_TIMEOUT_MS,
    DEFAULT_DB_BUSY_TIMEOUT_MS
  )
  const dbJournalMode = options.dbJournalMode ?? process.env.DB_JOURNAL_MODE ?? DEFAULT_DB_JOURNAL_MODE
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', true)
  app.use(cors({
    origin: allowedOrigin === '*' ? true : allowedOrigin
  }))
  app.use(express.json({ limit: jsonBodyLimit }))

  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  db.pragma(`busy_timeout = ${dbBusyTimeoutMs}`)
  db.pragma(`journal_mode = ${dbJournalMode}`)
  db.pragma('synchronous = NORMAL')
  initSchema(db)

  const startedAt = Date.now()

  const createHouseholdStmt = db.prepare(`
    INSERT INTO households (name, capacity_kw, price_per_kwh)
    VALUES (?, ?, ?)
  `)
  const updateHouseholdStmt = db.prepare(`
    UPDATE households
    SET name = ?, capacity_kw = ?, price_per_kwh = ?
    WHERE id = ?
  `)
  const upsertGenerationStmt = db.prepare(`
    INSERT INTO generation (household_id, date, kwh)
    VALUES (?, ?, ?)
    ON CONFLICT(household_id, date)
    DO UPDATE SET kwh = excluded.kwh
  `)
  const householdExistsStmt = db.prepare('SELECT id FROM households WHERE id = ?')
  const deleteHouseholdStmt = db.prepare('DELETE FROM households WHERE id = ?')
  const monthGenerationStmt = db.prepare(`
    SELECT household_id, date, kwh
    FROM generation
    WHERE substr(date, 1, 7) = ?
  `)

  const deleteHouseholdCascade = db.transaction((householdId) => {
    return deleteHouseholdStmt.run(householdId)
  })

  function parseHouseholdPayload(body) {
    return {
      name: requireNonEmptyString(body.name, '户名'),
      capacityKw: requireNonNegativeNumber(body.capacity_kw, '功率'),
      pricePerKwh: requireNonNegativeNumber(body.price_per_kwh, '电价')
    }
  }

  function requireExistingHousehold(id) {
    const householdId = requirePositiveInt(id, '用户ID')
    if (!householdExistsStmt.get(householdId)) {
      throw new HttpError(404, '用户不存在')
    }
    return householdId
  }

  function parseGenerationPayload(body) {
    const householdId = requireExistingHousehold(body.household_id)
    return {
      householdId,
      date: requireDate(body.date, '日期'),
      kwh: requireNonNegativeNumber(body.kwh, '电量')
    }
  }

  app.get('/health', route((req, res) => {
    let dbOk = true
    let dbErr = null

    if (enableDbHealthcheck) {
      try {
        db.prepare('SELECT 1 AS ok').get()
      } catch (error) {
        dbOk = false
        dbErr = String(error?.message || error)
      }
    }

    res.json({
      ok: enableDbHealthcheck ? dbOk : true,
      status: enableDbHealthcheck ? (dbOk ? 'ok' : 'degraded') : 'ok',
      service: 'pv-stat-server',
      version: APP_VERSION,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      time: Date.now(),
      env: process.env.NODE_ENV || 'development',
      checks: {
        db: enableDbHealthcheck ? dbOk : 'skipped',
        dbError: dbErr
      },
      config: {
        dbHealthcheck: enableDbHealthcheck,
        allowedOrigin,
        jsonBodyLimit,
        dbBusyTimeoutMs,
        dbJournalMode
      }
    })
  }))

  app.get('/live', route((req, res) => {
    res.json({
      success: true,
      status: 'live',
      version: APP_VERSION
    })
  }))

  app.get('/ready', route((req, res) => {
    try {
      db.prepare('SELECT 1 AS ok').get()
      res.json({
        success: true,
        status: 'ready',
        version: APP_VERSION
      })
    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'not_ready',
        error: String(error?.message || error)
      })
    }
  }))

  app.get('/households', route((req, res) => {
    res.json(db.prepare('SELECT * FROM households ORDER BY id ASC').all())
  }))

  app.post('/households', route((req, res) => {
    const payload = parseHouseholdPayload(req.body)
    const result = createHouseholdStmt.run(
      payload.name,
      payload.capacityKw,
      payload.pricePerKwh
    )
    res.status(201).json({ success: true, id: result.lastInsertRowid })
  }))

  app.put('/households/:id', route((req, res) => {
    const householdId = requireExistingHousehold(req.params.id)
    const payload = parseHouseholdPayload(req.body)
    updateHouseholdStmt.run(
      payload.name,
      payload.capacityKw,
      payload.pricePerKwh,
      householdId
    )
    res.json({ success: true })
  }))

  app.post('/generation', route((req, res) => {
    const payload = parseGenerationPayload(req.body)
    upsertGenerationStmt.run(
      payload.householdId,
      payload.date,
      payload.kwh
    )
    res.json({ success: true })
  }))

  app.get('/generation', route((req, res) => {
    const month = requireMonth(req.query.month)
    const rows = monthGenerationStmt.all(month)
    res.json(rows)
  }))

  app.delete('/households/:id', route((req, res) => {
    const householdId = requireExistingHousehold(req.params.id)
    deleteHouseholdCascade(householdId)
    res.json({ success: true })
  }))

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: '请求的接口不存在'
    })
  })

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err)
    }

    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({
        success: false,
        error: '请求体不是有效的JSON'
      })
    }

    const status = err instanceof HttpError ? err.status : 500
    const message = err instanceof HttpError ? err.message : '服务器内部错误，请稍后重试'

    if (!(err instanceof HttpError)) {
      console.error(err)
    }

    res.status(status).json({
      success: false,
      error: message
    })
  })

  return {
    app,
    db,
    close() {
      db.close()
    }
  }
}

export function startServer(options = {}) {
  const port = options.port ?? Number(process.env.PORT || 3000)
  const { app, db, close } = createApp(options)
  const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`)
  })

  let closed = false

  function shutdown() {
    if (closed) return
    closed = true
    server.close(() => {
      close()
    })
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)

  return {
    app,
    db,
    server,
    close() {
      process.removeListener('SIGINT', shutdown)
      process.removeListener('SIGTERM', shutdown)
      shutdown()
    }
  }
}

const isEntryFile = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (isEntryFile) {
  startServer()
}
