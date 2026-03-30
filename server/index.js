import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const APP_VERSION = process.env.APP_VERSION || '2.0.0'
const DEFAULT_JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '256kb'
const DEFAULT_DB_BUSY_TIMEOUT_MS = Number(process.env.DB_BUSY_TIMEOUT_MS || 5000)
const DEFAULT_DB_JOURNAL_MODE = process.env.DB_JOURNAL_MODE || 'WAL'
const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin'
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123'
const DEFAULT_AUTH_SECRET = process.env.AUTH_SECRET || 'pvstat-local-auth-secret'
const DEFAULT_AUTH_TOKEN_TTL_HOURS = Number(process.env.AUTH_TOKEN_TTL_HOURS || 24)

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

function requirePositiveIntArray(values, fieldName) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new HttpError(400, `${fieldName}不能为空`)
  }

  const result = values.map((value, index) => requirePositiveInt(value, `${fieldName}第${index + 1}项`))
  return Array.from(new Set(result))
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

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signTokenPayload(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url')
}

function createAuthToken({ username, expiresAt, secret }) {
  const payload = JSON.stringify({ username, expiresAt })
  const encodedPayload = toBase64Url(payload)
  const signature = signTokenPayload(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

function verifyAuthToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    throw new HttpError(401, '未登录或登录已过期')
  }

  const [encodedPayload, signature] = token.split('.', 2)
  const expectedSignature = signTokenPayload(encodedPayload, secret)
  if (signature !== expectedSignature) {
    throw new HttpError(401, '登录状态无效，请重新登录')
  }

  let payload
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload))
  } catch {
    throw new HttpError(401, '登录状态无效，请重新登录')
  }

  if (!payload?.username || !payload?.expiresAt || Date.now() >= Number(payload.expiresAt)) {
    throw new HttpError(401, '登录已过期，请重新登录')
  }

  return {
    username: payload.username,
    expiresAt: Number(payload.expiresAt)
  }
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

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    summary TEXT NOT NULL,
    status TEXT NOT NULL,
    client_ip TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_households_name ON households(name COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS idx_generation_date ON generation(date);
  CREATE INDEX IF NOT EXISTS idx_generation_household_date ON generation(household_id, date);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at DESC);
  `)
}

function getMonthDateRange(month) {
  const [year, mon] = month.split('-').map(Number)
  const start = `${year}-${String(mon).padStart(2, '0')}-01`
  const nextYear = mon === 12 ? year + 1 : year
  const nextMonth = mon === 12 ? 1 : mon + 1
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return { start, end }
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
  const adminUsername = options.adminUsername ?? process.env.ADMIN_USERNAME ?? DEFAULT_ADMIN_USERNAME
  const adminPassword = options.adminPassword ?? process.env.ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD
  const authSecret = options.authSecret ?? process.env.AUTH_SECRET ?? DEFAULT_AUTH_SECRET
  const authTokenTtlHours = normalizePositiveNumber(
    options.authTokenTtlHours ?? process.env.AUTH_TOKEN_TTL_HOURS,
    DEFAULT_AUTH_TOKEN_TTL_HOURS
  )
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
    WHERE date >= ? AND date < ?
    ORDER BY date ASC, household_id ASC
  `)
  const householdByIdStmt = db.prepare(`
    SELECT id, name, capacity_kw, price_per_kwh
    FROM households
    WHERE id = ?
  `)
  const householdHistorySummaryStmt = db.prepare(`
    SELECT
      substr(date, 1, 7) AS month,
      COUNT(*) AS filled_days,
      COALESCE(SUM(kwh), 0) AS total_kwh,
      COALESCE(AVG(kwh), 0) AS avg_daily_kwh,
      MIN(date) AS first_date,
      MAX(date) AS last_date
    FROM generation
    WHERE household_id = ?
    GROUP BY substr(date, 1, 7)
    ORDER BY month DESC
  `)
  const monthOverviewStmt = db.prepare(`
    SELECT
      COUNT(*) AS household_count,
      COALESCE(SUM(capacity_kw), 0) AS total_capacity_kw
    FROM households
  `)
  const monthUserSummaryStmt = db.prepare(`
    SELECT
      h.id AS household_id,
      COALESCE(SUM(g.kwh), 0) AS total_kwh,
      COALESCE(SUM(g.kwh), 0) * h.price_per_kwh AS total_amount,
      CASE
        WHEN h.capacity_kw > 0 THEN COALESCE(SUM(g.kwh), 0) / h.capacity_kw
        ELSE 0
      END AS eq_hours
    FROM households h
    LEFT JOIN generation g
      ON g.household_id = h.id
     AND g.date >= ?
     AND g.date < ?
    GROUP BY h.id
    ORDER BY h.id ASC
  `)
  const monthDailyTotalsStmt = db.prepare(`
    SELECT
      substr(g.date, 9, 2) AS day,
      COALESCE(SUM(g.kwh), 0) AS total_kwh,
      COALESCE(SUM(g.kwh * h.price_per_kwh), 0) AS total_amount
    FROM generation g
    INNER JOIN households h ON h.id = g.household_id
    WHERE g.date >= ?
      AND g.date < ?
    GROUP BY day
    ORDER BY day ASC
  `)
  const insertAuditLogStmt = db.prepare(`
    INSERT INTO audit_logs (
      created_at,
      username,
      action,
      target_type,
      target_id,
      summary,
      status,
      client_ip
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const countAuditLogsStmt = db.prepare(`
    SELECT COUNT(*) AS total
    FROM audit_logs
    WHERE (? = '' OR action = ?)
      AND (? = '' OR summary LIKE ? OR username LIKE ?)
  `)
  const listAuditLogsStmt = db.prepare(`
    SELECT
      id,
      created_at,
      username,
      action,
      target_type,
      target_id,
      summary,
      status,
      client_ip
    FROM audit_logs
    WHERE (? = '' OR action = ?)
      AND (? = '' OR summary LIKE ? OR username LIKE ?)
    ORDER BY created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `)

  const deleteHouseholdCascade = db.transaction((householdId) => {
    return deleteHouseholdStmt.run(householdId)
  })
  const deleteHouseholdsBatch = db.transaction((householdIds) => {
    householdIds.forEach((householdId) => {
      deleteHouseholdStmt.run(householdId)
    })
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

  function parseBatchDeletePayload(body) {
    const ids = requirePositiveIntArray(body?.ids, '用户ID列表')
    ids.forEach((id) => {
      if (!householdExistsStmt.get(id)) {
        throw new HttpError(404, `用户不存在: ${id}`)
      }
    })
    return ids
  }

  function parseGenerationPayload(body) {
    const householdId = requireExistingHousehold(body.household_id)
    return {
      householdId,
      date: requireDate(body.date, '日期'),
      kwh: requireNonNegativeNumber(body.kwh, '电量')
    }
  }

  function parseAuditLogQuery(query) {
    const page = Math.max(1, Number(query.page || 1) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(query.page_size || 20) || 20))
    const action = String(query.action || '').trim().toUpperCase()
    const keyword = String(query.keyword || '').trim()
    return {
      page,
      pageSize,
      action,
      keyword
    }
  }

  function requireAuth(req, res, next) {
    const authHeader = String(req.headers.authorization || '')
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    try {
      req.auth = verifyAuthToken(token, authSecret)
      next()
    } catch (error) {
      next(error)
    }
  }

  function parseLoginPayload(body) {
    return {
      username: requireNonEmptyString(body.username, '用户名'),
      password: requireNonEmptyString(body.password, '密码')
    }
  }

  function issueLoginResponse(username) {
    const expiresAt = Date.now() + authTokenTtlHours * 60 * 60 * 1000
    const token = createAuthToken({
      username,
      expiresAt,
      secret: authSecret
    })
    return {
      token,
      user: {
        username,
        expiresAt
      }
    }
  }

  function getClientIp(req) {
    const socketAddress = req?.socket?.remoteAddress || req?.connection?.remoteAddress || ''
    const forwardedFor = req?.headers?.['x-forwarded-for'] || ''
    let ip = ''
    try {
      ip = typeof req?.ip === 'string' ? req.ip : ''
    } catch {
      ip = ''
    }
    return String(ip || forwardedFor || socketAddress || '')
  }

  function writeAuditLog(req, payload) {
    insertAuditLogStmt.run(
      new Date().toISOString(),
      payload.username,
      payload.action,
      payload.targetType || '',
      payload.targetId == null ? '' : String(payload.targetId),
      payload.summary,
      payload.status || 'success',
      getClientIp(req)
    )
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

  app.post('/auth/login', route((req, res) => {
    const payload = parseLoginPayload(req.body)
    if (payload.username !== adminUsername || payload.password !== adminPassword) {
      writeAuditLog(req, {
        username: payload.username,
        action: 'LOGIN',
        targetType: 'auth',
        targetId: payload.username,
        summary: `登录失败：${payload.username}`,
        status: 'failed'
      })
      throw new HttpError(401, '用户名或密码错误')
    }
    writeAuditLog(req, {
      username: payload.username,
      action: 'LOGIN',
      targetType: 'auth',
      targetId: payload.username,
      summary: `登录成功：${payload.username}`
    })
    res.json({
      success: true,
      ...issueLoginResponse(payload.username)
    })
  }))

  app.get('/auth/me', requireAuth, route((req, res) => {
    res.json({
      success: true,
      user: req.auth
    })
  }))

  app.get('/households', route((req, res) => {
    res.json(db.prepare('SELECT * FROM households ORDER BY id ASC').all())
  }))

  app.post('/households', requireAuth, route((req, res) => {
    const payload = parseHouseholdPayload(req.body)
    const result = createHouseholdStmt.run(
      payload.name,
      payload.capacityKw,
      payload.pricePerKwh
    )
    writeAuditLog(req, {
      username: req.auth.username,
      action: 'HOUSEHOLD_CREATE',
      targetType: 'household',
      targetId: result.lastInsertRowid,
      summary: `新增用户：${payload.name}`
    })
    res.status(201).json({ success: true, id: result.lastInsertRowid })
  }))

  app.put('/households/:id', requireAuth, route((req, res) => {
    const householdId = requireExistingHousehold(req.params.id)
    const payload = parseHouseholdPayload(req.body)
    updateHouseholdStmt.run(
      payload.name,
      payload.capacityKw,
      payload.pricePerKwh,
      householdId
    )
    writeAuditLog(req, {
      username: req.auth.username,
      action: 'HOUSEHOLD_UPDATE',
      targetType: 'household',
      targetId: householdId,
      summary: `编辑用户：${payload.name}`
    })
    res.json({ success: true })
  }))

  app.post('/households/batch-delete', requireAuth, route((req, res) => {
    const ids = parseBatchDeletePayload(req.body)
    deleteHouseholdsBatch(ids)
    writeAuditLog(req, {
      username: req.auth.username,
      action: 'HOUSEHOLD_BATCH_DELETE',
      targetType: 'household',
      targetId: ids.join(','),
      summary: `批量删除用户 ${ids.length} 个`
    })
    res.json({
      success: true,
      deletedCount: ids.length
    })
  }))

  app.post('/generation', requireAuth, route((req, res) => {
    const payload = parseGenerationPayload(req.body)
    upsertGenerationStmt.run(
      payload.householdId,
      payload.date,
      payload.kwh
    )
    writeAuditLog(req, {
      username: req.auth.username,
      action: 'GENERATION_UPSERT',
      targetType: 'generation',
      targetId: `${payload.householdId}:${payload.date}`,
      summary: `录入发电量：用户 ${payload.householdId} ${payload.date} ${payload.kwh} kWh`
    })
    res.json({ success: true })
  }))

  app.get('/generation', route((req, res) => {
    const month = requireMonth(req.query.month)
    const range = getMonthDateRange(month)
    const rows = monthGenerationStmt.all(range.start, range.end)
    res.json(rows)
  }))

  app.get('/generation/summary', route((req, res) => {
    const month = requireMonth(req.query.month)
    const range = getMonthDateRange(month)
    const overview = monthOverviewStmt.get()
    const userStats = monthUserSummaryStmt.all(range.start, range.end).map((row) => ({
      householdId: Number(row.household_id),
      monthTotalKwh: Number(row.total_kwh) || 0,
      monthTotalAmount: Number(row.total_amount) || 0,
      monthEqHours: Number(row.eq_hours) || 0
    }))
    const dailyTotals = monthDailyTotalsStmt.all(range.start, range.end).map((row) => ({
      day: row.day,
      kwh: Number(row.total_kwh) || 0,
      amount: Number(row.total_amount) || 0
    }))
    const grandTotals = userStats.reduce((acc, item) => {
      acc.kwh += item.monthTotalKwh
      acc.amount += item.monthTotalAmount
      return acc
    }, { kwh: 0, amount: 0 })

    res.json({
      month,
      householdCount: Number(overview.household_count) || 0,
      totalCapacityKw: Number(overview.total_capacity_kw) || 0,
      grandTotals,
      userStats,
      dailyTotals
    })
  }))

  app.get('/households/:id/history-summary', route((req, res) => {
    const householdId = requireExistingHousehold(req.params.id)
    const household = householdByIdStmt.get(householdId)
    const rows = householdHistorySummaryStmt.all(householdId)
    const pricePerKwh = Number(household.price_per_kwh) || 0
    const months = rows.map((row) => {
      const totalKwh = Number(row.total_kwh) || 0
      return {
        month: row.month,
        filledDays: Number(row.filled_days) || 0,
        totalKwh,
        avgDailyKwh: Number(row.avg_daily_kwh) || 0,
        estimatedAmount: totalKwh * pricePerKwh,
        firstDate: row.first_date,
        lastDate: row.last_date
      }
    })
    const totalKwh = months.reduce((sum, item) => sum + item.totalKwh, 0)

    res.json({
      household: {
        id: household.id,
        name: household.name,
        capacityKw: Number(household.capacity_kw) || 0,
        pricePerKwh
      },
      totals: {
        months: months.length,
        totalKwh,
        estimatedAmount: totalKwh * pricePerKwh
      },
      months
    })
  }))

  app.get('/audit-logs', requireAuth, route((req, res) => {
    const query = parseAuditLogQuery(req.query)
    const keywordLike = query.keyword ? `%${query.keyword}%` : ''
    const total = Number(countAuditLogsStmt.get(
      query.action,
      query.action,
      query.keyword,
      keywordLike,
      keywordLike
    ).total) || 0
    const rows = listAuditLogsStmt.all(
      query.action,
      query.action,
      query.keyword,
      keywordLike,
      keywordLike,
      query.pageSize,
      (query.page - 1) * query.pageSize
    )

    res.json({
      success: true,
      items: rows,
      page: query.page,
      pageSize: query.pageSize,
      total
    })
  }))

  app.delete('/households/:id', requireAuth, route((req, res) => {
    const householdId = requireExistingHousehold(req.params.id)
    const household = householdByIdStmt.get(householdId)
    deleteHouseholdCascade(householdId)
    writeAuditLog(req, {
      username: req.auth.username,
      action: 'HOUSEHOLD_DELETE',
      targetType: 'household',
      targetId: householdId,
      summary: `删除用户：${household?.name || householdId}`
    })
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
