<script setup>
import { ref, reactive, onMounted, computed, nextTick } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchGenerationByMonth, fetchHouseholds, upsertGeneration } from '../api/pvstat'
import { useDashboardStats } from '../composables/useDashboardStats'
import { useHouseholdManagement } from '../composables/useHouseholdManagement'
import DashboardEmptyState from '../components/DashboardEmptyState.vue'
import DashboardHeader from '../components/DashboardHeader.vue'
import DashboardTotalCard from '../components/DashboardTotalCard.vue'
import HouseholdCard from '../components/HouseholdCard.vue'
import UserFormDialog from '../components/UserFormDialog.vue'

const households = ref([])
const month = ref(dayjs().format('YYYY-MM'))
const pageLoading = ref(false)
const monthLoading = ref(false)
const loadError = ref('')
const savingCells = reactive({})

const isPageBusy = computed(() => {
  return pageLoading.value || monthLoading.value
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
  await initializePage()
})

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
  await loadGeneration()
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
} = useDashboardStats(households, daysInMonth)

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
</script>

<template>
  <div class="page">
    <div v-if="isPageBusy" class="page-mask">
      <div class="page-mask-card">
        <div class="page-mask-title">{{ pageLoading ? '正在加载数据' : '正在切换月份' }}</div>
        <div class="page-mask-sub">请稍候，正在同步最新的用户与发电数据。</div>
      </div>
    </div>

    <dashboard-header
      v-model:month="month"
      v-model:jump-day="jumpDay"
      :month-label="monthLabel"
      :days-in-month="daysInMonth"
      :is-page-busy="isPageBusy"
      :households-count="households.length"
      :total-capacity-kw="totalCapacityKw"
      :summary-month-kwh="summaryMonthKwh"
      :summary-month-amount="summaryMonthAmount"
      @month-change="onMonthChange"
      @jump="scrollAllToDay"
      @today="goToday"
      @create="openCreateDialog"
    />

    <div v-if="loadError" class="error-banner">
      <div class="error-title">数据加载遇到问题</div>
      <div class="error-text">{{ loadError }}</div>
    </div>

    <dashboard-empty-state
      v-if="!hasHouseholds && !isPageBusy"
      kind="no-users"
      :month-label="monthLabel"
      @primary="openCreateDialog"
    />

    <dashboard-empty-state
      v-else-if="!hasGenerationData && !isPageBusy"
      kind="no-generation"
      :month-label="monthLabel"
      @primary="goToday"
      @secondary="scrollAllToDay('01')"
    />

    <!-- 用户卡片 -->
    <div v-else class="grid">
      <household-card
        v-for="u in households"
        :key="u.id"
        :user="u"
        :month-label="monthLabel"
        :days-in-month="daysInMonth"
        :user-style="cardStyleByUser(u)"
        :is-page-busy="isPageBusy"
        :deleting="deletingUserId === u.id"
        :get-user-stats="getUserStats"
        :get-per-kw="getPerKw"
        :get-amount="getAmount"
        :fmt-zero="fmtZero"
        :is-cell-saving="isCellSaving"
        :normalize-number-input="normalizeNumberInput"
        :save-kwh="saveKwh"
        :set-scroll-ref="setScrollRef"
        @edit="openEdit"
        @delete="removeUser"
      />
    </div>

    <dashboard-total-card
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
  padding: 18px;
  min-height: 100%;
  background: radial-gradient(1200px 600px at 20% 0%, #eef2ff 0%, transparent 60%),
              radial-gradient(900px 500px at 90% 20%, #fdf2f8 0%, transparent 55%),
              #f6f7fb;
  position: relative;
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
  font-size: 16px;
  font-weight: 900;
  color: #0f172a;
}

.page-mask-sub{
  margin-top: 6px;
  font-size: 13px;
  color: #64748b;
}

.error-banner{
  margin-bottom: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(254, 242, 242, .88);
  border: 1px solid rgba(220, 38, 38, .14);
  box-shadow: 0 10px 24px rgba(220, 38, 38, .08);
}

.error-title{
  font-size: 14px;
  font-weight: 900;
  color: #991b1b;
}

.error-text{
  margin-top: 4px;
  font-size: 12px;
  color: #b91c1c;
}

.grid{ display:flex; flex-direction: column; gap: 12px; }

/* ===== Centered Footer Card ===== */
.footer-card{
  margin: 60px auto 40px;
  max-width: 1400px;
  padding: 28px 20px;
  border-radius: 22px;
  text-align: center;

  background: rgba(255,255,255,0.7);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);

  box-shadow:
    0 20px 60px rgba(0,0,0,0.06),
    inset 0 1px 0 rgba(255,255,255,0.9);
}

.footer-content{
  font-size: 14px;
  letter-spacing: 2px;
  font-weight: 600;
  color: rgba(0,0,0,0.65);
}

</style>
