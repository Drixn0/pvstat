<script setup>
import { ref, reactive, onMounted, computed, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchGenerationByMonth, fetchGenerationSummary, fetchHouseholds, upsertGeneration } from '../api/pvstat'
import { useDashboardStats } from '../composables/useDashboardStats'
import { useHouseholdManagement } from '../composables/useHouseholdManagement'
import DashboardEmptyState from '../components/DashboardEmptyState.vue'
import DashboardHeader from '../components/DashboardHeader.vue'
import DashboardTotalCard from '../components/DashboardTotalCard.vue'
import HouseholdCard from '../components/HouseholdCard.vue'
import UserFormDialog from '../components/UserFormDialog.vue'
import { useAuth } from '../composables/useAuth'

const route = useRoute()
const router = useRouter()
const {
  isAuthenticated,
  openLoginDialog
} = useAuth()
const households = ref([])
const monthlySummary = ref(null)
const month = ref(String(route.query.month || dayjs().format('YYYY-MM')))
const pageLoading = ref(false)
const monthLoading = ref(false)
const loadError = ref('')
const savingCells = reactive({})

const isPageBusy = computed(() => {
  return pageLoading.value || monthLoading.value
})
const isInitialLoading = computed(() => {
  return pageLoading.value && households.value.length === 0
})

// ====== 只显示当月天数 ======
const dayCount = computed(() => {
  const base = dayjs(`${month.value}-01`)
  return base.isValid() ? base.daysInMonth() : 31
})
const daysInMonth = computed(() => {
  return Array.from({ length: dayCount.value }, (_, i) => String(i + 1).padStart(2, '0'))
})

// ====== 跳转到某一天 ======
const jumpDay = ref(String(route.query.day || '01').padStart(2, '0'))

// scroll refs
const scrollRefMap = new Map()
function setScrollRef(key, el) {
  if (!key) return
  if (el) scrollRefMap.set(String(key), el)
  else scrollRefMap.delete(String(key))
}

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
  for (const el of scrollRefMap.values()) {
    const targetEl = el?.children?.[idx]
    const left = targetEl?.offsetLeft ?? 0
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
  await initializePage()
})

watch([month, jumpDay], async () => {
  await router.replace({
    query: {
      ...route.query,
      month: month.value !== dayjs().format('YYYY-MM') ? month.value : undefined,
      day: jumpDay.value !== '01' ? jumpDay.value : undefined
    }
  })
}, { flush: 'post' })

function getErrorMessage(error, fallback = '操作失败，请稍后重试') {
  return error?.response?.data?.error || error?.message || fallback
}

const {
  dialogVisible,
  editDialogVisible,
  creatingUser,
  updatingUser,
  deletingUserId,
  newUser,
  editUser,
  openCreateDialog,
  closeCreateDialog,
  closeEditDialog,
  openEdit,
  addUser,
  saveEdit,
  removeUser
} = useHouseholdManagement({
  loadAll,
  getErrorMessage,
  message: ElMessage,
  messageBox: ElMessageBox
})

function requestManageAuth(message = '登录后才能修改数据') {
  openLoginDialog(message)
}

function openCreateGuarded() {
  if (!isAuthenticated.value) return requestManageAuth('登录后才能新增用户')
  openCreateDialog()
}

function openEditGuarded(user) {
  if (!isAuthenticated.value) return requestManageAuth('登录后才能编辑用户')
  openEdit(user)
}

function removeUserGuarded(user) {
  if (!isAuthenticated.value) return requestManageAuth('登录后才能删除用户')
  removeUser(user)
}

function markCellSaving(userId, day, saving) {
  const key = `${userId}-${day}`
  if (saving) {
    savingCells[key] = true
    return
  }
  delete savingCells[key]
}

function isCellSaving(userId, day) {
  return Boolean(savingCells[`${userId}-${day}`])
}

async function initializePage() {
  pageLoading.value = true
  loadError.value = ''
  try {
    await loadAll()
    goToday()
  } catch (error) {
    loadError.value = getErrorMessage(error, '页面初始化失败，请刷新后重试')
    ElMessage.error(loadError.value)
  } finally {
    pageLoading.value = false
  }
}

async function loadAll() {
  const householdList = await fetchHouseholds()
  households.value = householdList.map((h) => ({
    ...h,
    days: {}
  }))
  await Promise.all([loadGeneration(), loadGenerationSummary()])
}

async function loadGeneration() {
  const generationList = await fetchGenerationByMonth(month.value)
  const usersById = new Map()
  households.value.forEach((u) => {
    u.days = {}
    usersById.set(u.id, u)
  })

  generationList.forEach(g => {
    const day = g.date.slice(8, 10)
    const user = usersById.get(g.household_id)
    if (user) user.days[day] = Number(g.kwh) || 0
  })
}

async function loadGenerationSummary() {
  monthlySummary.value = await fetchGenerationSummary(month.value)
}

async function saveKwh(userId, day, value) {
  const date = `${month.value}-${day}`
  const kwh = Number(value)
  markCellSaving(userId, day, true)
  try {
    await upsertGeneration({
      household_id: userId,
      date,
      kwh: Number.isFinite(kwh) ? kwh : 0
    })
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '保存电量失败'))
    throw error
  } finally {
    markCellSaving(userId, day, false)
  }
}

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
const {
  totalCapacityKw,
  grandTotals,
  hasHouseholds,
  hasGenerationData,
  summaryMonthKwh,
  summaryMonthAmount,
  getUserStats,
  getDailyTotals
} = useDashboardStats(households, daysInMonth, monthlySummary)

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
  monthLoading.value = true
  loadError.value = ''
  try {
    await loadAll()
    goToday()
  } catch (error) {
    loadError.value = getErrorMessage(error, '切换月份失败')
    ElMessage.error(loadError.value)
  } finally {
    monthLoading.value = false
  }
}

function exportMonthlyDetails() {
  const rows = []
  households.value.forEach((user) => {
    daysInMonth.value.forEach((day) => {
      const date = `${month.value}-${day}`
      const kwh = getKwh(user, day)
      const perKw = getPerKw(user, day)
      const amount = getAmount(user, day)
      rows.push([
        month.value,
        date,
        user.id,
        `"${String(user.name || '').replaceAll('"', '""')}"`,
        Number(user.capacity_kw || 0).toFixed(2),
        Number(user.price_per_kwh || 0).toFixed(2),
        kwh.toFixed(2),
        perKw.toFixed(3),
        amount.toFixed(2)
      ])
    })
  })

  const csv = [
    ['月份', '日期', '用户ID', '户名', '功率(kW)', '电价(元/度)', '发电量(kWh)', '每kW发电量', '金额(元)'].join(','),
    ...rows.map((row) => row.join(','))
  ].join('\n')

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `发电明细-${month.value}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${monthLabel.value} 发电明细`)
}
</script>

<template>
  <div class="page">
    <div v-if="monthLoading && !isInitialLoading" class="page-mask">
      <div class="page-mask-card">
        <div class="page-mask-title">正在切换月份</div>
        <div class="page-mask-sub">请稍候，正在同步最新的用户与发电数据。</div>
      </div>
    </div>

    <dashboard-header
      v-model:month="month"
      v-model:jump-day="jumpDay"
      :month-label="monthLabel"
      :days-in-month="daysInMonth"
      :is-page-busy="isPageBusy"
      :loading="isInitialLoading"
      :can-manage="isAuthenticated"
      :households-count="households.length"
      :total-capacity-kw="totalCapacityKw"
      :summary-month-kwh="summaryMonthKwh"
      :summary-month-amount="summaryMonthAmount"
      @month-change="onMonthChange"
      @jump="scrollAllToDay"
      @today="goToday"
      @export="exportMonthlyDetails"
      @create="openCreateGuarded"
    />

    <div v-if="!isAuthenticated || loadError" class="status-stack">
      <div v-if="!isAuthenticated" class="readonly-banner">
        <div class="status-copy">
          <div class="readonly-title">当前为只读模式</div>
          <div class="readonly-text">未登录时可以查看统计和导出明细，但不能新增、修改、删除或录入发电数据。</div>
        </div>
        <button class="readonly-btn" @click="requestManageAuth('登录后才能新增、修改、删除和录入数据')">管理员登录</button>
      </div>

      <div v-if="loadError" class="error-banner">
        <div class="status-copy">
          <div class="error-title">数据加载遇到问题</div>
          <div class="error-text">{{ loadError }}</div>
        </div>
      </div>
    </div>

    <div v-if="isInitialLoading" class="dashboard-skeleton-list">
      <div class="dashboard-skeleton-card" v-for="idx in 2" :key="`dashboard-skeleton-${idx}`">
        <div class="dashboard-skeleton-header">
          <div class="dashboard-skeleton-line wide"></div>
          <div class="dashboard-skeleton-actions">
            <div class="dashboard-skeleton-pill"></div>
            <div class="dashboard-skeleton-pill"></div>
          </div>
        </div>
        <div class="dashboard-skeleton-stats">
          <div class="dashboard-skeleton-stat" v-for="n in 3" :key="`stat-${idx}-${n}`"></div>
        </div>
        <div class="dashboard-skeleton-grid">
          <div class="dashboard-skeleton-col head"></div>
          <div class="dashboard-skeleton-col" v-for="n in 6" :key="`col-${idx}-${n}`"></div>
        </div>
      </div>
      <div class="dashboard-skeleton-total">
        <div class="dashboard-skeleton-line wide"></div>
        <div class="dashboard-skeleton-grid">
          <div class="dashboard-skeleton-col head"></div>
          <div class="dashboard-skeleton-col" v-for="n in 7" :key="`total-col-${n}`"></div>
        </div>
      </div>
    </div>

    <dashboard-empty-state
      v-if="!hasHouseholds && !isPageBusy"
      kind="no-users"
      :month-label="monthLabel"
      @primary="openCreateDialog"
    />

    <dashboard-empty-state
      v-if="hasHouseholds && !hasGenerationData && !isPageBusy"
      kind="no-generation"
      :month-label="monthLabel"
      @primary="goToday"
      @secondary="scrollAllToDay('01')"
    />

    <!-- 用户卡片 -->
    <section v-if="hasHouseholds && !isInitialLoading" class="content-section">
      <div class="section-head">
        <div>
          <div class="section-title">用户录入卡片</div>
          <div class="section-sub">保留卡片式录入体验，支持按用户连续填写当月每日发电量。</div>
        </div>
        <div class="section-chip">{{ households.length }} 户</div>
      </div>

      <div class="grid">
      <household-card
        v-for="u in households"
        :key="u.id"
        :user="u"
        :month-label="monthLabel"
        :days-in-month="daysInMonth"
        :user-style="cardStyleByUser(u)"
        :is-page-busy="isPageBusy"
        :deleting="deletingUserId === u.id"
        :can-manage="isAuthenticated"
        :get-user-stats="getUserStats"
        :get-per-kw="getPerKw"
        :get-amount="getAmount"
        :fmt-zero="fmtZero"
        :is-cell-saving="isCellSaving"
        :normalize-number-input="normalizeNumberInput"
        :save-kwh="saveKwh"
        :set-scroll-ref="setScrollRef"
        :request-auth="requestManageAuth"
        @edit="openEditGuarded"
        @delete="removeUserGuarded"
      />
      </div>
    </section>

    <section v-if="!isInitialLoading && hasHouseholds" class="content-section total-section">
      <div class="section-head total-section-head">
        <div>
          <div class="section-title">月度合计总览</div>
          <div class="section-sub">把所有用户的每日发电量和金额叠加，适合快速复核整个月走势。</div>
        </div>
        <div class="section-chip neutral">自动汇总</div>
      </div>

      <dashboard-total-card
        :has-households="hasHouseholds"
        :grand-totals="grandTotals"
        :days-in-month="daysInMonth"
        :get-daily-totals="getDailyTotals"
        :set-scroll-ref="setScrollRef"
      />
    </section>

    <dashboard-total-card
      v-else-if="!isInitialLoading"
      :has-households="hasHouseholds"
      :grand-totals="grandTotals"
      :days-in-month="daysInMonth"
      :get-daily-totals="getDailyTotals"
      :set-scroll-ref="setScrollRef"
    />

    <user-form-dialog
      v-model="dialogVisible"
      title="新增用户"
      :form="newUser"
      :loading="creatingUser"
      name-placeholder="例如：张三"
      @update:model-value="closeCreateDialog"
      @submit="addUser"
    />

    <user-form-dialog
      v-model="editDialogVisible"
      title="编辑用户"
      :form="editUser"
      :loading="updatingUser"
      @update:model-value="closeEditDialog"
      @submit="saveEdit"
    />

    <div class="footer-card">
      <div class="footer-content">
        DESIGNED BY 大白白
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 背景：iOS/macOS 轻磨砂 */
.page{
  padding: 14px;
  min-height: 100%;
  background: radial-gradient(1200px 600px at 20% 0%, #eef2ff 0%, transparent 60%),
              radial-gradient(900px 500px at 90% 20%, #fdf2f8 0%, transparent 55%),
              #f6f7fb;
  position: relative;
}

.status-stack{
  display:grid;
  gap: 8px;
  margin-bottom: 8px;
}

.page-mask{
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(246, 247, 251, .55);
  backdrop-filter: blur(6px);
}

.page-mask-card{
  width: min(360px, calc(100vw - 32px));
  padding: 18px 20px;
  border-radius: 20px;
  background: rgba(255,255,255,.86);
  border: 1px solid rgba(15,23,42,.08);
  box-shadow: 0 18px 50px rgba(15,23,42,.14);
}

.page-mask-title{
  font-size: 17px;
  font-weight: 900;
  color: #0f172a;
}

.page-mask-sub{
  margin-top: 6px;
  font-size: 14px;
  color: #64748b;
}

.error-banner{
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(254, 242, 242, .88);
  border: 1px solid rgba(220, 38, 38, .14);
  box-shadow: 0 10px 24px rgba(220, 38, 38, .08);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;
}

.error-title{
  font-size: 15px;
  font-weight: 900;
  color: #991b1b;
}

.error-text{
  margin-top: 4px;
  font-size: 13px;
  color: #b91c1c;
}

.readonly-banner{
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(254,249,195,.72);
  border: 1px solid rgba(234,179,8,.22);
  box-shadow: 0 10px 24px rgba(234,179,8,.08);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 14px;
}

.status-copy{
  min-width: 0;
}

.readonly-title{
  font-size: 14px;
  font-weight: 900;
  color:#854d0e;
}

.readonly-text{
  margin-top: 4px;
  font-size: 13px;
  color:#713f12;
}

.readonly-btn{
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
  color:#fff;
  background: linear-gradient(135deg, #d97706 0%, #ea580c 100%);
  box-shadow: 0 10px 24px rgba(234,88,12,.18);
}

.content-section{
  margin-top: 2px;
}

.section-head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap: 12px;
  margin-bottom: 8px;
  padding: 2px 2px 0;
}

.section-title{
  font-size: 16px;
  font-weight: 900;
  color:#14213d;
}

.section-sub{
  margin-top: 3px;
  font-size: 12px;
  color:#64748b;
}

.section-chip{
  height: 28px;
  padding: 0 10px;
  display:flex;
  align-items:center;
  border-radius: 999px;
  background: rgba(255,255,255,.8);
  border: 1px solid rgba(184,198,226,.28);
  font-size: 12px;
  font-weight: 800;
  color:#3451a3;
}

.section-chip.neutral{
  color:#52627f;
}

.total-section{
  margin-top: 8px;
}

.grid{ display:flex; flex-direction: column; gap: 8px; }

.dashboard-skeleton-list{
  display:flex;
  flex-direction:column;
  gap: 12px;
}

.dashboard-skeleton-card,
.dashboard-skeleton-total{
  border: 1px solid rgba(15,23,42,.06);
  background: rgba(255,255,255,.74);
  border-radius: 22px;
  padding: 14px;
  box-shadow: 0 12px 28px rgba(15,23,42,.07);
}

.dashboard-skeleton-header,
.dashboard-skeleton-actions,
.dashboard-skeleton-stats,
.dashboard-skeleton-grid{
  display:flex;
  gap: 12px;
}

.dashboard-skeleton-header{
  justify-content:space-between;
  align-items:center;
}

.dashboard-skeleton-actions{
  gap: 10px;
}

.dashboard-skeleton-line,
.dashboard-skeleton-pill,
.dashboard-skeleton-stat,
.dashboard-skeleton-col{
  background: linear-gradient(90deg, rgba(226,232,240,.75), rgba(248,250,252,.98), rgba(226,232,240,.75));
  background-size: 200% 100%;
  animation: dashboardSkeletonShift 1.4s ease-in-out infinite;
}

.dashboard-skeleton-line{
  height: 18px;
  border-radius: 999px;
}

.dashboard-skeleton-line.wide{
  width: 220px;
}

.dashboard-skeleton-pill{
  width: 88px;
  height: 36px;
  border-radius: 999px;
}

.dashboard-skeleton-stats{
  margin-top: 14px;
}

.dashboard-skeleton-stat{
  flex: 1 1 0;
  height: 74px;
  border-radius: 16px;
}

.dashboard-skeleton-grid{
  margin-top: 16px;
  overflow:hidden;
}

.dashboard-skeleton-col{
  flex: 1 1 0;
  height: 118px;
  border-radius: 14px;
}

.dashboard-skeleton-col.head{
  max-width: 110px;
}

@keyframes dashboardSkeletonShift{
  0%{ background-position: 200% 0; }
  100%{ background-position: -200% 0; }
}

/* ===== Centered Footer Card ===== */
.footer-card{
  margin: 28px auto 22px;
  max-width: 720px;
  padding: 16px 18px;
  border-radius: 18px;
  text-align: center;

  background: rgba(255,255,255,0.56);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);

  box-shadow:
    0 12px 28px rgba(0,0,0,0.04),
    inset 0 1px 0 rgba(255,255,255,0.9);
}

.footer-content{
  font-size: 15px;
  letter-spacing: 2px;
  font-weight: 600;
  color: rgba(0,0,0,0.52);
}

@media (max-width: 960px){
  .readonly-banner,
  .error-banner,
  .section-head{
    align-items:flex-start;
    flex-direction:column;
  }
}

</style>
