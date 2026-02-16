import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'

const app = express()
app.use(cors())
app.use(express.json())

const db = new Database('pv.db')

// server 启动时间（用于 uptime）
const startedAt = Date.now()

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
  UNIQUE(household_id, date)
);
`)

// 企业级 health：用于前端监控小组件
app.get('/health', (req, res) => {
  let dbOk = true
  let dbErr = null
  try {
    db.prepare('SELECT 1 AS ok').get()
  } catch (e) {
    dbOk = false
    dbErr = String(e?.message || e)
  }

  res.json({
    ok: dbOk,
    service: 'pv-stat-server',
    version: '1.0.0',
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    time: Date.now(),
    checks: {
      db: dbOk,
      dbError: dbErr
    }
  })
})

app.get('/households', (req, res) => {
  res.json(db.prepare('SELECT * FROM households').all())
})

app.post('/households', (req, res) => {
  db.prepare(`
    INSERT INTO households (name, capacity_kw, price_per_kwh)
    VALUES (?, ?, ?)
  `).run(
    req.body.name,
    req.body.capacity_kw,
    req.body.price_per_kwh
  )
  res.json({ success: true })
})

app.put('/households/:id', (req, res) => {
  db.prepare(`
    UPDATE households
    SET name=?, capacity_kw=?, price_per_kwh=?
    WHERE id=?
  `).run(
    req.body.name,
    req.body.capacity_kw,
    req.body.price_per_kwh,
    req.params.id
  )
  res.json({ success: true })
})

app.post('/generation', (req, res) => {
  db.prepare(`
    INSERT INTO generation (household_id, date, kwh)
    VALUES (?, ?, ?)
    ON CONFLICT(household_id, date)
    DO UPDATE SET kwh=excluded.kwh
  `).run(
    req.body.household_id,
    req.body.date,
    req.body.kwh
  )
  res.json({ success: true })
})

app.get('/generation', (req, res) => {
  const { month } = req.query
  if (!month) return res.json([])

  const rows = db.prepare(`
    SELECT household_id, date, kwh
    FROM generation
    WHERE substr(date,1,7)=?
  `).all(month)

  res.json(rows)
})

app.delete('/households/:id', (req, res) => {
  db.prepare('DELETE FROM households WHERE id=?')
    .run(req.params.id)
  res.json({ success:true })
})

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000')
})
