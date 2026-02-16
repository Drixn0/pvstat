<script setup>

// ===== 用户总功率合计 =====
const totalCapacityKw = computed(() => {
  return households.value.reduce((sum, h) => {
    return sum + Number(h.capacity_kw || 0)
  }, 0)
})


import { ref, onMounted, computed, nextTick } from 'vue'
import axios from 'axios'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Delete, Plus, Calendar, Aim } from '@element-plus/icons-vue'

// const API = 'http://localhost:3000'
const API = '/api'
const households = ref([])
const month = ref(dayjs().format('YYYY-MM'))

// dialogs
const dialogVisible = ref(false)
const editDialogVisible = ref(false)

const newUser = ref({
  name: '',
  capacity_kw: 10,
  price_per_kwh: 0.98
})
const editUser = ref({})

// ====== 只显示当月天数 ======
const dayCount = computed(() => {
  const base = dayjs(`${month.value}-01`)
  return base.isValid() ? base.daysInMonth() : 31
})
const daysInMonth = computed(() => {
  return Array.from({ length: dayCount.value }, (_, i) => String(i + 1).padStart(2, '0'))
})

// ====== 跳转到某一天 ======
const jumpDay = ref('01')

// scroll refs
const scrollRefMap = new Map()
function setScrollRef(key, el) {
  if (!key) return
  if (el) scrollRefMap.set(String(key), el)
  else scrollRefMap.delete(String(key))
}

const COL_W = 108
const COL_GAP = 10
const STEP = COL_W + COL_GAP

function clampJumpDay(d) {
  const n = Number(d)
  if (!Number.isFinite(n) || n < 1) return '01'
  const max = dayCount.value
  if (n > max) return String(max).padStart(2, '0')
  return String(n).padStart(2, '0')
}

async function scrollAllToDay(d) {
  const dayKey = clampJumpDay(d)
  jumpDay.value = dayKey
  const idx = daysInMonth.value.indexOf(dayKey)
  if (idx < 0) return

  await nextTick()
  const left = idx * STEP
  for (const el of scrollRefMap.values()) {
    try {
      el.scrollTo({ left, behavior: 'smooth' })
    } catch {
      el.scrollLeft = left
    }
  }
}

function goToday() {
  const now = dayjs()
  const cur = now.format('YYYY-MM')
  const target = cur === month.value ? now.format('DD') : '01'
  scrollAllToDay(target)
}

onMounted(async () => {
  await loadAll()
  goToday()
})

async function loadAll() {
  const hRes = await axios.get(`${API}/households`)
  households.value = hRes.data.map(h => ({
    ...h,
    days: {}
  }))
  await loadGeneration()
}

async function loadGeneration() {
  const gRes = await axios.get(`${API}/generation`, { params: { month: month.value } })
  households.value.forEach(u => (u.days = {}))
  gRes.data.forEach(g => {
    const day = g.date.slice(8, 10)
    const user = households.value.find(u => u.id === g.household_id)
    if (user) user.days[day] = Number(g.kwh) || 0
  })
}

async function saveKwh(userId, day, value) {
  const date = `${month.value}-${day}`
  const kwh = Number(value)
  await axios.post(`${API}/generation`, {
    household_id: userId,
    date,
    kwh: Number.isFinite(kwh) ? kwh : 0
  })
}

// ====== 计算（按户、按天）======
function getKwh(u, day) {
  return Number(u.days?.[day]) || 0
}
function getPerKw(u, day) {
  const cap = Number(u.capacity_kw) || 0
  if (!cap) return 0
  return getKwh(u, day) / cap
}
function getAmount(u, day) {
  const price = Number(u.price_per_kwh) || 0
  return getKwh(u, day) * price
}
function monthTotalKwh(u) {
  return Object.values(u.days || {}).reduce((a, b) => a + (Number(b) || 0), 0)
}
function monthTotalAmount(u) {
  const price = Number(u.price_per_kwh) || 0
  return monthTotalKwh(u) * price
}
function monthEqHours(u) {
  const cap = Number(u.capacity_kw) || 0
  if (!cap) return 0
  return monthTotalKwh(u) / cap
}

// ====== 全体合计 ======
function dayTotalKwh(dayStr) {
  return households.value.reduce((s, u) => s + (Number(u.days?.[dayStr]) || 0), 0)
}
function dayTotalAmount(dayStr) {
  return households.value.reduce((s, u) => {
    const kwh = Number(u.days?.[dayStr]) || 0
    const price = Number(u.price_per_kwh) || 0
    return s + kwh * price
  }, 0)
}
function grandTotalKwh() {
  return households.value.reduce((s, u) => s + monthTotalKwh(u), 0)
}
function grandTotalAmount() {
  return households.value.reduce((s, u) => s + monthTotalAmount(u), 0)
}

const monthLabel = computed(() => {
  const m = Number(month.value?.slice(5, 7) || 0)
  return m ? `${m}月` : ''
})

// ====== iOS 色卡：同一用户稳定同色（不会刷新乱跳）=====
const gradients = [
  { a: '#E0F2FE', b: '#FDF2F8', c: '#FFFFFF' }, // sky -> pink
  { a: '#ECFDF5', b: '#EFF6FF', c: '#FFFFFF' }, // green -> blue
  { a: '#FFF7ED', b: '#EEF2FF', c: '#FFFFFF' }, // orange -> indigo
  { a: '#F5F3FF', b: '#ECFEFF', c: '#FFFFFF' }, // violet -> cyan
  { a: '#FDF4FF', b: '#FFFBEB', c: '#FFFFFF' }, // fuchsia -> amber
  { a: '#F1F5F9', b: '#E0E7FF', c: '#FFFFFF' }  // slate -> indigo
]
function hashToIndex(id) {
  const s = String(id ?? '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % gradients.length
}
function cardStyleByUser(user) {
  const g = gradients[hashToIndex(user.id)]
  return {
    background: `linear-gradient(135deg, ${g.a} 0%, ${g.b} 48%, ${g.c} 100%)`,
    border: '1px solid rgba(15,23,42,.06)'
  }
}

// ====== 用户管理 ======
async function addUser() {
  if (!newUser.value.name?.trim()) return ElMessage.warning('请输入户名')
  await axios.post(`${API}/households`, newUser.value)
  ElMessage.success('新增成功')
  dialogVisible.value = false
  newUser.value = { name: '', capacity_kw: 10, price_per_kwh: 0.98 }
  await loadAll()
}

function openEdit(user) {
  editUser.value = {
    id: user.id,
    name: user.name,
    capacity_kw: user.capacity_kw,
    price_per_kwh: user.price_per_kwh
  }
  editDialogVisible.value = true
}

async function saveEdit() {
  if (!editUser.value.name?.trim()) return ElMessage.warning('请输入户名')
  await axios.put(`${API}/households/${editUser.value.id}`, editUser.value)
  ElMessage.success('修改成功')
  editDialogVisible.value = false
  await loadAll()
}

async function deleteUser(user) {
  await ElMessageBox.confirm(`确定删除用户【${user.name}】？`, '提示', { type: 'warning' })
  await axios.delete(`${API}/households/${user.id}`)
  ElMessage.success('删除成功')
  await loadAll()
}

// 纯输入：字符串转数字
function normalizeNumberInput(user, dayKey) {
  const n = Number(user.days?.[dayKey])
  user.days[dayKey] = Number.isFinite(n) ? n : 0
}

function fmtZero(v, digits = 2) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

async function onMonthChange() {
  await loadAll()
  goToday()
}
</script>

<template>
  <div class="page">
    <!-- 顶部导航（macOS/iOS） -->
    <div class="nav">
      <div class="nav-left">
        <div class="app-title">光伏发电统计</div>
        <div class="app-sub">卡片视图 · 录入电量自动算每kW与金额</div>
      </div>

      <div class="nav-right">
        <div class="month">
          <div class="label"><el-icon><Calendar /></el-icon> 月份</div>
          <el-date-picker
            v-model="month"
            type="month"
            format="M月"
            value-format="YYYY-MM"
            :clearable="false"
            @change="onMonthChange"
            class="ios-picker"
          />
        </div>

        <div class="jump">
          <div class="label"><el-icon><Aim /></el-icon> 跳到</div>
          <div class="jump-row">
            <el-select v-model="jumpDay" class="ios-select" @change="scrollAllToDay">
              <el-option v-for="d in daysInMonth" :key="'opt-' + d" :label="Number(d) + '日'" :value="d" />
            </el-select>

            <el-button class="ios-btn" @click="scrollAllToDay(jumpDay)">跳转</el-button>
            <el-button class="ios-btn ios-btn-primary" @click="goToday">今日</el-button>
          </div>
        </div>

        <el-button class="ios-btn ios-btn-primary" @click="dialogVisible = true">
          <el-icon><Plus /></el-icon>
          新增用户
        </el-button>
      </div>
    </div>

    <!-- 总览（iOS小组件风） -->
    <div class="summary">
      <div class="summary-card">
        <div class="summary-label">统计月份</div>
        <div class="summary-value">{{ monthLabel }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">用户数量</div>
        <div class="summary-value">{{ households.length }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">用户总功率</div>
        <div class="summary-value">
          {{ totalCapacityKw.toFixed(2) }} <span class="unit">kW</span>
        </div>
      </div>      
      <div class="summary-card">
        <div class="summary-label">月累计发电量</div>
        <div class="summary-value">{{ grandTotalKwh().toFixed(2) }} <span class="unit">kWh</span></div>
      </div>
      <div class="summary-card">
        <div class="summary-label">月累计发电金额</div>
        <div class="summary-value money">¥{{ grandTotalAmount().toFixed(2) }}</div>
      </div>
    </div>

    <!-- 用户卡片 -->
    <div class="grid">
      <div v-for="u in households" :key="u.id" class="user-card" :style="cardStyleByUser(u)">
        <div class="card-head">
          <div class="who">
            <div class="name">{{ u.name }}</div>
            <div class="meta">
              <span class="pill">功率 {{ fmtZero(u.capacity_kw, 2) }} kW</span>
              <span class="pill">电价 {{ fmtZero(u.price_per_kwh, 2) }} 元/度</span>
            </div>
          </div>

          <div class="card-actions">
            <button class="icon-pill" @click="openEdit(u)" title="编辑">
              <el-icon><Edit /></el-icon>
              编辑
            </button>
            <button class="icon-pill danger" @click="deleteUser(u)" title="删除">
              <el-icon><Delete /></el-icon>
              删除
            </button>
          </div>
        </div>

        <div class="stats">
          <div class="stat">
            <div class="stat-label">月总电量</div>
            <div class="stat-value">{{ monthTotalKwh(u).toFixed(2) }} <span class="unit">kWh</span></div>
          </div>
          <div class="stat">
            <div class="stat-label">1KW发电量</div>
            <div class="stat-value">{{ monthEqHours(u).toFixed(2) }}</div>
          </div>
          <div class="stat">
            <div class="stat-label">月总金额</div>
            <div class="stat-value money">¥{{ monthTotalAmount(u).toFixed(2) }}</div>
          </div>
        </div>

        <div class="day-strip">
          <div class="day-col day-col-head">
            <div class="day-title">日</div>
            <div class="row-title kwh">电量</div>
            <div class="row-title perkw">每kW</div>
            <div class="row-title amount">金额</div>
          </div>

          <div class="day-scroll" :ref="el => setScrollRef(u.id, el)">
            <div class="day-col" v-for="d in daysInMonth" :key="u.id + '-' + d">
              <div class="day-title">{{ Number(d) }}</div>

              <el-input
                v-model="u.days[d]"
                size="small"
                class="cell-input"
                inputmode="decimal"
                placeholder="0"
                @blur="
                  () => {
                    normalizeNumberInput(u, d)
                    saveKwh(u.id, d, u.days[d])
                  }
                "
                @keyup.enter="
                  () => {
                    normalizeNumberInput(u, d)
                    saveKwh(u.id, d, u.days[d])
                  }
                "
              />

              <div class="cell-text">{{ getPerKw(u, d).toFixed(3) }}</div>
              <div class="cell-text money">¥{{ getAmount(u, d).toFixed(2) }}</div>
            </div>
          </div>
        </div>

        <div class="hint">只需填“电量”，下面两行自动计算；回车或失焦自动保存。</div>
      </div>
    </div>

    <!-- 合计卡片 -->
    <div class="total-card">
      <div class="total-head">
        <div>
          <div class="total-title">合计</div>
          <div class="total-sub">按日汇总所有用户（两行：电量、金额）</div>
        </div>
        <div class="total-right">
          <div class="total-kpi">
            <div class="kpi-label">月总电量</div>
            <div class="kpi-value">{{ grandTotalKwh().toFixed(2) }} <span class="unit">kWh</span></div>
          </div>
          <div class="total-kpi">
            <div class="kpi-label">月总金额</div>
            <div class="kpi-value money">¥{{ grandTotalAmount().toFixed(2) }}</div>
          </div>
        </div>
      </div>

      <div class="total-strip">
        <div class="day-col day-col-head">
          <div class="day-title">日</div>
          <div class="row-title kwh">合计-发电量</div>
          <div class="row-title amount">合计-金额</div>
        </div>

        <div class="day-scroll" :ref="el => setScrollRef('TOTAL', el)">
          <div class="day-col" v-for="d in daysInMonth" :key="'TOTAL-' + d">
            <div class="day-title">{{ Number(d) }}</div>
            <div class="cell-text strong">{{ dayTotalKwh(d).toFixed(2) }}</div>
            <div class="cell-text money strong">¥{{ dayTotalAmount(d).toFixed(2) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增用户（iOS风格弹窗） -->
    <el-dialog v-model="dialogVisible" width="520px" class="ios-dialog" :show-close="false" align-center>
      <template #header>
        <div class="dialog-header">
          <div class="dialog-title">新增用户</div>
          <button class="dialog-close" @click="dialogVisible = false">完成</button>
        </div>
      </template>

      <div class="form-ios">
        <div class="form-row">
          <div class="form-label">户名</div>
          <el-input v-model="newUser.name" class="ios-input" placeholder="例如：张三" />
        </div>

        <div class="form-row">
          <div class="form-label">功率(kW)</div>
          <el-input-number v-model="newUser.capacity_kw" :min="0" controls-position="right" class="ios-number" />
        </div>

        <div class="form-row">
          <div class="form-label">电价(元/度)</div>
          <el-input-number v-model="newUser.price_per_kwh" :min="0" :step="0.01" :precision="2" controls-position="right" class="ios-number" />
        </div>

        <div class="form-actions">
          <el-button class="ios-btn" @click="dialogVisible=false">取消</el-button>
          <el-button class="ios-btn ios-btn-primary" @click="addUser">保存</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 编辑用户（iOS风格弹窗） -->
    <el-dialog v-model="editDialogVisible" width="520px" class="ios-dialog" :show-close="false" align-center>
      <template #header>
        <div class="dialog-header">
          <div class="dialog-title">编辑用户</div>
          <button class="dialog-close" @click="editDialogVisible = false">完成</button>
        </div>
      </template>

      <div class="form-ios">
        <div class="form-row">
          <div class="form-label">户名</div>
          <el-input v-model="editUser.name" class="ios-input" />
        </div>

        <div class="form-row">
          <div class="form-label">功率(kW)</div>
          <el-input-number v-model="editUser.capacity_kw" :min="0" controls-position="right" class="ios-number" />
        </div>

        <div class="form-row">
          <div class="form-label">电价(元/度)</div>
          <el-input-number v-model="editUser.price_per_kwh" :min="0" :step="0.01" :precision="2" controls-position="right" class="ios-number" />
        </div>

        <div class="form-actions">
          <el-button class="ios-btn" @click="editDialogVisible=false">取消</el-button>
          <el-button class="ios-btn ios-btn-primary" @click="saveEdit">保存</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 背景：iOS/macOS 轻磨砂 */
.page{
  padding: 18px;
  min-height: 100%;
  background: radial-gradient(1200px 600px at 20% 0%, #eef2ff 0%, transparent 60%),
              radial-gradient(900px 500px at 90% 20%, #fdf2f8 0%, transparent 55%),
              #f6f7fb;
}

/* 顶部导航 */
.nav{
  display:flex;
  align-items:flex-end;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}
.app-title{
  font-size: 20px;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: .2px;
}
.app-sub{
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}
.nav-right{
  display:flex;
  align-items:flex-end;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.label{
  display:flex;
  align-items:center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 6px;
}

/* iOS风控件 */
.ios-picker :deep(.el-input__wrapper),
.ios-select :deep(.el-input__wrapper){
  border-radius: 12px;
  background: rgba(255,255,255,.75);
  border: 1px solid rgba(15,23,42,.08);
  box-shadow: 0 6px 16px rgba(15,23,42,.06);
}
.ios-select{ width: 92px; }
.jump-row{ display:flex; gap:8px; align-items:center; }

.ios-btn{
  border-radius: 12px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.78);
  box-shadow: 0 6px 16px rgba(15,23,42,.06);
}
.ios-btn:hover{ transform: translateY(-1px); transition: .15s; }
.ios-btn-primary{
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%) !important;
  border: none !important;
  color: #fff !important;
}

/* 概览 */
.summary{
  display:grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.summary-card{
  border: 1px solid rgba(15, 23, 42, .06);
  background: rgba(255,255,255,.70);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 12px 14px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, .08);
}
.summary-label{ font-size: 12px; color: #64748b; }
.summary-value{
  margin-top: 6px;
  font-size: 18px;
  font-weight: 900;
  color: #0f172a;
}
.summary-value.money{ color:#d33; }
.unit{ font-size: 12px; color:#64748b; font-weight:700; margin-left:4px; }

/* 用户卡片 */
.grid{ display:flex; flex-direction: column; gap: 12px; }
.user-card{
  border-radius: 18px;
  padding: 14px;
  box-shadow: 0 14px 34px rgba(15,23,42,.10);
}

/* 头部 */
.card-head{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: nowrap;           /* 强制同一行 */
}

/* 左侧：户名 + 标签（功率/电价）一行展示 */
.who{
  display:flex;
  align-items:center;
  gap: 14px;
  min-width: 0;                /* 允许内部省略 */
  flex: 1 1 auto;
}

.name{
  font-size: 16px;
  font-weight: 950;
  color:#0f172a;
  white-space: nowrap;
  flex: 0 0 auto;
}

/* 功率/电价：横向玻璃标签 */
.meta{
  display:flex;
  align-items:center;
  gap:10px;
  flex-wrap: nowrap;
  min-width: 0;
  overflow: hidden;
}

.pill{
  font-size: 12px;
  font-weight: 900;
  color:#0f172a;
  white-space: nowrap;

  padding: 6px 10px;
  border-radius: 999px;

  background: rgba(255,255,255,.52);
  border: 1px solid rgba(15,23,42,.08);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.85),
    0 10px 24px rgba(15,23,42,.10);
  backdrop-filter: blur(10px) saturate(160%);
  -webkit-backdrop-filter: blur(10px) saturate(160%);
}

/* iOS风按钮（编辑/删除） */
.card-actions{
  display:flex;
  align-items:center;
  gap: 10px;
  flex-shrink: 0;

  /* 右侧悬浮胶囊（发布会风） */
  padding: 6px;
  border-radius: 999px;
  background: rgba(255,255,255,.55);
  border: 1px solid rgba(15,23,42,.08);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.80),
    0 14px 34px rgba(15,23,42,.14);
  backdrop-filter: blur(12px) saturate(160%);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
}
.icon-pill{
  display:flex;
  align-items:center;
  gap: 6px;
  font-size: 12px;
  font-weight: 900;

  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.70);
  box-shadow: none;
  cursor: pointer;
  transition: transform .15s ease, background .15s ease;
}
.icon-pill:hover{ transform: translateY(-1px); transition: .15s; }
.icon-pill.danger{
  border: 1px solid rgba(220,38,38,.20);
  color: #b91c1c;
  background: rgba(254,242,242,.85);
}

/* 月统计 */
.stats{
  margin-top: 12px;
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.stat{
  border: 1px solid rgba(15,23,42,.06);
  background: rgba(255,255,255,.82);
  border-radius: 14px;
  padding: 10px 12px;
  box-shadow: 0 8px 18px rgba(15,23,42,.06);
}
.stat-label{ font-size: 12px; color:#64748b; }
.stat-value{ margin-top: 6px; font-size: 14px; font-weight: 900; color:#0f172a; }
.stat-value.money{ color:#d33; }

/* 日条 */
.day-strip, .total-strip{
  margin-top: 12px;
  display:flex;
  gap: 10px;
  align-items: stretch;
}

.day-col-head{
  width: 110px;
  flex: 0 0 110px;
  border: 1px solid rgba(15,23,42,.06);
  background: rgba(255,255,255,.85);
  border-radius: 14px;
  padding: 10px;
  box-shadow: 0 8px 18px rgba(15,23,42,.06);
}
.row-title{ font-size: 12px; color:#64748b; margin-top: 10px; }
.row-title.kwh{ font-weight: 900; color:#334155; }
.row-title.amount{ color:#d33; font-weight: 900; }

/* 右侧滚动区（与JS STEP一致） */
.day-scroll{
  display:grid;
  grid-auto-flow: column;
  grid-auto-columns: 108px;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
.day-scroll::-webkit-scrollbar{ height: 10px; }
.day-scroll::-webkit-scrollbar-thumb{ background: rgba(15,23,42,.14); border-radius: 999px; }
.day-scroll::-webkit-scrollbar-track{ background: rgba(15,23,42,.05); border-radius: 999px; }

.day-col{
  border: 1px solid rgba(15,23,42,.06);
  background: rgba(255,255,255,.86);
  border-radius: 14px;
  padding: 10px 10px 12px;
  box-shadow: 0 8px 18px rgba(15,23,42,.06);
}
.day-title{ font-size: 12px; color:#64748b; font-weight: 900; }

/* 输入框 */
.cell-input{ margin-top: 8px; }
.cell-input :deep(.el-input__wrapper){
  border-radius: 12px;
  background: rgba(15,23,42,.04);
  box-shadow: none;
  padding: 0 10px;
  border: 1px solid rgba(15,23,42,.06);
}
.cell-input :deep(input){
  text-align: right;
  font-weight: 900;
  color:#0f172a;
}

/* 文本行 */
.cell-text{
  margin-top: 10px;
  text-align: right;
  font-size: 12px;
  font-weight: 900;
  color:#0f172a;
}
.cell-text.money{ color:#d33; }
.cell-text.strong{ font-weight: 1000; }

.hint{ margin-top: 10px; font-size: 12px; color:#64748b; }

/* 合计卡 */
.total-card{
  margin-top: 14px;
  border: 1px solid rgba(15,23,42,.06);
  background: rgba(255,255,255,.72);
  backdrop-filter: blur(10px);
  border-radius: 18px;
  padding: 14px;
  box-shadow: 0 14px 34px rgba(15,23,42,.10);
}
.total-head{
  display:flex;
  align-items:flex-end;
  justify-content: space-between;
  gap: 12px;
}
.total-title{ font-size: 16px; font-weight: 900; color:#0f172a; }
.total-sub{ margin-top: 4px; font-size: 12px; color:#64748b; }
.total-right{ display:flex; gap: 14px; }
.total-kpi .kpi-label{ font-size: 12px; color:#64748b; }
.total-kpi .kpi-value{ margin-top: 6px; font-size: 14px; font-weight: 900; color:#0f172a; text-align:right; }
.total-kpi .kpi-value.money{ color:#d33; }

/* iOS / Apple Keynote dialog（更像系统 Sheet） */
:deep(.ios-dialog .el-dialog){
  border-radius: 24px;
  overflow: hidden;
  background: rgba(255,255,255,.70);
  backdrop-filter: blur(26px) saturate(170%);
  -webkit-backdrop-filter: blur(26px) saturate(170%);
  border: 1px solid rgba(15,23,42,.10);
  box-shadow:
    0 28px 80px rgba(15,23,42,.22),
    0 10px 26px rgba(15,23,42,.12);
}
:deep(.ios-dialog .el-dialog__header){ margin: 0; padding: 0; }
:deep(.ios-dialog .el-dialog__body){ padding: 0; }

/* 头部：淡光晕 + 大标题 */
.dialog-header{
  position: relative;
  display:flex;
  align-items:center;
  justify-content: space-between;
  padding: 16px 18px 14px;
  border-bottom: 1px solid rgba(15,23,42,.06);
  background: linear-gradient(180deg, rgba(99,102,241,.10) 0%, rgba(236,72,153,.06) 50%, rgba(255,255,255,0) 100%);
}
.dialog-header::before{
  content:"";
  position:absolute;
  left:50%;
  top:-120px;
  transform: translateX(-50%);
  width: 760px;
  height: 260px;
  background: radial-gradient(circle at 50% 70%, rgba(99,102,241,.18), rgba(236,72,153,.10), transparent 70%);
  filter: blur(16px);
  pointer-events:none;
}
.dialog-title{
  position: relative;
  z-index: 1;
  font-size: 18px;
  font-weight: 950;
  color:#0f172a;
  letter-spacing: .2px;
}
.dialog-close{
  position: relative;
  z-index: 1;
  border: 1px solid rgba(15,23,42,.08);
  background: rgba(255,255,255,.70);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 999px;
  padding: 8px 12px;
  font-weight: 950;
  color:#2563eb;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
}
.dialog-close:active{ transform: translateY(1px); }

/* 表单：iOS Inset Grouped 风格 */
.form-ios{
  padding: 16px 16px 18px;
}
.form-row{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 14px;
  border-radius: 18px;
  background: rgba(255,255,255,.78);
  border: 1px solid rgba(15,23,42,.08);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.85),
    0 14px 30px rgba(15,23,42,.08);
  margin-bottom: 12px;
}
.form-label{
  font-size: 13px;
  font-weight: 950;
  color:#0f172a;
  width: 96px;
  flex: 0 0 96px;
  opacity: .92;
}

/* 输入控件更“系统” */
.ios-input{
  width: 100%;
}
.ios-input :deep(.el-input__wrapper){
  border-radius: 14px;
  background: rgba(15,23,42,.03);
  box-shadow: none;
  border: 1px solid rgba(15,23,42,.08);
  padding: 10px 12px;
}
.ios-input :deep(.el-input__inner){
  font-weight: 700;
  color: #0f172a;
}

.ios-number{
  width: 100%;
}
.ios-number :deep(.el-input__wrapper){
  border-radius: 14px;
  background: rgba(15,23,42,.03);
  box-shadow: none;
  border: 1px solid rgba(15,23,42,.08);
  padding: 10px 12px;
}

/* 隐藏数字输入的上下按钮（更像 iOS，直接输入） */
.ios-number :deep(.el-input-number__increase),
.ios-number :deep(.el-input-number__decrease){
  display: none !important;
}
.ios-number :deep(.el-input-number .el-input__wrapper){
  padding-right: 12px; /* 去掉控制按钮后的右侧空位 */
}

.form-actions{
  display:flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 6px;
  padding-top: 6px;
}

/* 按钮在弹窗里更像 iOS */
.form-actions .ios-btn{
  border-radius: 999px;
  padding: 10px 18px;
}

/* 响应式 */
@media (max-width: 1200px){
  .summary{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stats{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* 小屏：允许换行，避免拥挤 */
@media (max-width: 820px){
  .card-head{ flex-wrap: wrap; align-items:flex-start; }
  .meta{ flex-wrap: wrap; }
  .card-actions{ width: 100%; justify-content: flex-end; }
}

</style>