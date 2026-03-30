<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElDialog, ElMessage, ElMessageBox } from 'element-plus'
import { deleteHouseholdsBatch, fetchHouseholdHistorySummary, fetchHouseholds } from '../api/pvstat'
import UserFormDialog from '../components/UserFormDialog.vue'
import { useHouseholdManagement } from '../composables/useHouseholdManagement'

const route = useRoute()
const router = useRouter()
const households = ref([])
const loading = ref(false)
const loadError = ref('')
const keyword = ref(String(route.query.keyword || ''))
const sortKey = ref(String(route.query.sort || 'name-asc'))
const pageSize = ref([4, 6, 8, 12].includes(Number(route.query.page_size)) ? Number(route.query.page_size) : 6)
const currentPage = ref(Math.max(1, Number(route.query.page || 1) || 1))
const selectedIds = ref([])
const bulkDeleting = ref(false)
const historyDialogVisible = ref(false)
const historyLoading = ref(false)
const historyData = ref(null)
const isInitialLoading = computed(() => loading.value && households.value.length === 0)

function getErrorMessage(error, fallback = '操作失败，请稍后重试') {
  return error?.response?.data?.error || error?.message || fallback
}

function formatNumber(value, digits = 2) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0.00'
  return num.toFixed(digits)
}

function formatMonth(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return month || '—'
  return `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`
}

function clearMissingSelections() {
  const validIds = new Set(households.value.map((item) => item.id))
  selectedIds.value = selectedIds.value.filter((id) => validIds.has(id))
}

async function loadAll() {
  loading.value = true
  loadError.value = ''
  try {
    households.value = await fetchHouseholds()
    clearMissingSelections()
  } catch (error) {
    loadError.value = getErrorMessage(error, '加载用户列表失败')
    ElMessage.error(loadError.value)
  } finally {
    loading.value = false
  }
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

const filteredHouseholds = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return households.value.slice()
  return households.value.filter((item) => String(item.name || '').toLowerCase().includes(q))
})

const sortedHouseholds = computed(() => {
  const list = filteredHouseholds.value.slice()
  const compareMap = {
    'name-asc': (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'),
    'name-desc': (a, b) => String(b.name || '').localeCompare(String(a.name || ''), 'zh-CN'),
    'capacity-desc': (a, b) => Number(b.capacity_kw || 0) - Number(a.capacity_kw || 0),
    'capacity-asc': (a, b) => Number(a.capacity_kw || 0) - Number(b.capacity_kw || 0),
    'price-desc': (a, b) => Number(b.price_per_kwh || 0) - Number(a.price_per_kwh || 0),
    'price-asc': (a, b) => Number(a.price_per_kwh || 0) - Number(b.price_per_kwh || 0),
    'id-desc': (a, b) => Number(b.id || 0) - Number(a.id || 0)
  }
  const sorter = compareMap[sortKey.value] || compareMap['name-asc']
  return list.sort(sorter)
})

const totalPages = computed(() => Math.max(1, Math.ceil(sortedHouseholds.value.length / pageSize.value)))

const pagedHouseholds = computed(() => {
  const safePage = Math.min(Math.max(1, currentPage.value), totalPages.value)
  const start = (safePage - 1) * pageSize.value
  return sortedHouseholds.value.slice(start, start + pageSize.value)
})

const currentPageSelection = computed(() => {
  const ids = new Set(selectedIds.value)
  return pagedHouseholds.value.filter((user) => ids.has(user.id))
})

const allCurrentPageSelected = computed(() => {
  return pagedHouseholds.value.length > 0 && currentPageSelection.value.length === pagedHouseholds.value.length
})

const totalCapacityKw = computed(() => {
  return households.value.reduce((sum, item) => sum + (Number(item.capacity_kw) || 0), 0)
})

const averagePrice = computed(() => {
  if (!households.value.length) return 0
  const total = households.value.reduce((sum, item) => sum + (Number(item.price_per_kwh) || 0), 0)
  return total / households.value.length
})

const highestCapacityUser = computed(() => {
  if (!households.value.length) return null
  return households.value.reduce((max, item) => {
    return Number(item.capacity_kw || 0) > Number(max.capacity_kw || 0) ? item : max
  }, households.value[0])
})

const historyChartMax = computed(() => {
  if (!historyData.value?.months?.length) return 0
  return historyData.value.months.reduce((max, item) => Math.max(max, Number(item.totalKwh) || 0), 0)
})

function normalizePage() {
  currentPage.value = Math.min(Math.max(1, currentPage.value), totalPages.value)
}

function resetToFirstPage() {
  currentPage.value = 1
}

function changePage(page) {
  currentPage.value = Math.min(Math.max(1, page), totalPages.value)
}

function toggleUserSelection(userId, checked) {
  const next = new Set(selectedIds.value)
  if (checked) next.add(userId)
  else next.delete(userId)
  selectedIds.value = Array.from(next)
}

function toggleCurrentPageSelection(checked) {
  const next = new Set(selectedIds.value)
  pagedHouseholds.value.forEach((user) => {
    if (checked) next.add(user.id)
    else next.delete(user.id)
  })
  selectedIds.value = Array.from(next)
}

function exportHouseholds() {
  const source = selectedIds.value.length
    ? sortedHouseholds.value.filter((user) => selectedIds.value.includes(user.id))
    : sortedHouseholds.value
  const rows = source.map((user) => [
    user.id,
    `"${String(user.name || '').replaceAll('"', '""')}"`,
    Number(user.capacity_kw || 0).toFixed(2),
    Number(user.price_per_kwh || 0).toFixed(2)
  ])

  const csv = [
    ['用户ID', '户名', '装机功率(kW)', '电价(元/度)'].join(','),
    ...rows.map((row) => row.join(','))
  ].join('\n')

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `用户清单-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${source.length} 条用户记录`)
}

async function removeSelectedUsers() {
  const ids = selectedIds.value.slice()
  if (!ids.length) return ElMessage.warning('请先勾选要删除的用户')

  try {
    await ElMessageBox.confirm(`确定批量删除已勾选的 ${ids.length} 个用户吗？关联发电数据也会一并删除。`, '批量删除确认', {
      type: 'warning'
    })
  } catch {
    return
  }

  bulkDeleting.value = true
  try {
    const result = await deleteHouseholdsBatch(ids)
    ElMessage.success(`已删除 ${result.deletedCount || ids.length} 个用户`)
    selectedIds.value = []
    await loadAll()
    normalizePage()
  } catch (error) {
    ElMessage.error(getErrorMessage(error, '批量删除失败'))
  } finally {
    bulkDeleting.value = false
  }
}

async function openHistory(user) {
  historyLoading.value = true
  historyDialogVisible.value = true
  historyData.value = null
  try {
    historyData.value = await fetchHouseholdHistorySummary(user.id)
  } catch (error) {
    historyDialogVisible.value = false
    ElMessage.error(getErrorMessage(error, '加载用户历史汇总失败'))
  } finally {
    historyLoading.value = false
  }
}

function closeHistory() {
  historyDialogVisible.value = false
  historyData.value = null
}

onMounted(() => {
  loadAll()
})

watch(sortedHouseholds, () => {
  normalizePage()
}, { flush: 'post' })

watch([keyword, sortKey, pageSize, currentPage], async () => {
  const query = {
    ...route.query,
    keyword: keyword.value || undefined,
    sort: sortKey.value !== 'name-asc' ? sortKey.value : undefined,
    page_size: pageSize.value !== 6 ? String(pageSize.value) : undefined,
    page: currentPage.value > 1 ? String(currentPage.value) : undefined
  }
  await router.replace({ query })
}, { flush: 'post' })
</script>

<template>
  <div class="page">
    <section class="hero">
      <div>
        <div class="hero-title">用户管理</div>
        <div class="hero-sub">集中维护用户资料，首页继续专注录入每月发电数据。</div>
      </div>

      <div class="hero-actions">
        <label class="search-box">
          <span>搜索用户</span>
          <input v-model="keyword" type="text" placeholder="输入户名筛选" :disabled="loading" @input="resetToFirstPage" />
        </label>

        <label class="search-box">
          <span>排序方式</span>
          <select v-model="sortKey" :disabled="loading" @change="resetToFirstPage">
            <option value="name-asc">户名 A-Z</option>
            <option value="name-desc">户名 Z-A</option>
            <option value="capacity-desc">功率从高到低</option>
            <option value="capacity-asc">功率从低到高</option>
            <option value="price-desc">电价从高到低</option>
            <option value="price-asc">电价从低到高</option>
            <option value="id-desc">最近新增优先</option>
          </select>
        </label>

        <button class="ghost-btn" :disabled="loading" @click="loadAll">
          {{ loading ? '刷新中...' : '刷新列表' }}
        </button>
        <button class="ghost-btn" :disabled="loading || !sortedHouseholds.length" @click="exportHouseholds">
          导出清单
        </button>
        <button class="danger-btn" :disabled="loading || bulkDeleting || !selectedIds.length" @click="removeSelectedUsers">
          {{ bulkDeleting ? '删除中...' : `批量删除${selectedIds.length ? `(${selectedIds.length})` : ''}` }}
        </button>
        <button class="primary-btn" :disabled="loading" @click="openCreateDialog">新增用户</button>
      </div>
    </section>

    <section class="summary">
      <div class="summary-card">
        <div class="summary-label">用户总数</div>
        <div v-if="isInitialLoading" class="summary-skeleton"></div>
        <div v-else class="summary-value">{{ households.length }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">总装机功率</div>
        <div v-if="isInitialLoading" class="summary-skeleton"></div>
        <div v-else class="summary-value">{{ formatNumber(totalCapacityKw) }} <span class="unit">kW</span></div>
      </div>
      <div class="summary-card">
        <div class="summary-label">平均电价</div>
        <div v-if="isInitialLoading" class="summary-skeleton"></div>
        <div v-else class="summary-value">¥{{ formatNumber(averagePrice) }} <span class="unit">元/度</span></div>
      </div>
      <div class="summary-card">
        <div class="summary-label">最大功率用户</div>
        <div v-if="isInitialLoading" class="summary-skeleton"></div>
        <div v-else class="summary-value summary-text">
          {{ highestCapacityUser ? highestCapacityUser.name : '暂无' }}
          <span v-if="highestCapacityUser" class="unit">{{ formatNumber(highestCapacityUser.capacity_kw) }} kW</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-label">已勾选用户</div>
        <div v-if="isInitialLoading" class="summary-skeleton"></div>
        <div v-else class="summary-value">{{ selectedIds.length }}</div>
      </div>
    </section>

    <section v-if="isInitialLoading" class="user-skeleton-grid">
      <div class="user-skeleton-card" v-for="idx in 4" :key="`user-skeleton-${idx}`">
        <div class="user-skeleton-top">
          <div class="user-skeleton-line large"></div>
          <div class="user-skeleton-actions">
            <div class="user-skeleton-pill"></div>
            <div class="user-skeleton-pill"></div>
          </div>
        </div>
        <div class="user-skeleton-metrics">
          <div class="user-skeleton-box" v-for="n in 2" :key="`metric-${idx}-${n}`"></div>
        </div>
      </div>
    </section>

    <div v-if="loadError" class="error-banner">
      <div class="error-title">用户列表加载失败</div>
      <div class="error-text">{{ loadError }}</div>
    </div>

    <section v-if="!households.length && !loading" class="empty-card">
      <div class="empty-title">还没有用户档案</div>
      <div class="empty-text">先创建用户资料，后续每个月都直接复用这些用户录入电量，不需要重复新增。</div>
      <button class="primary-btn" @click="openCreateDialog">立即新增用户</button>
    </section>

    <template v-else-if="!sortedHouseholds.length && !loading">
      <section class="empty-card">
        <div class="empty-title">没有匹配到用户</div>
        <div class="empty-text">换个关键词试试，或者清空搜索条件查看全部用户。</div>
        <button class="ghost-btn" @click="keyword = ''; resetToFirstPage()">清空搜索</button>
      </section>
    </template>

    <template v-else>
      <section class="toolbar-card">
        <label class="select-all">
          <input
            type="checkbox"
            :checked="allCurrentPageSelected"
            :disabled="!pagedHouseholds.length"
            @change="toggleCurrentPageSelection($event.target.checked)"
          />
          <span>全选当前页</span>
        </label>

        <div class="toolbar-meta">
          <span>共 {{ sortedHouseholds.length }} 条</span>
          <span>每页 {{ pageSize }} 条</span>
          <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
        </div>
      </section>

      <section class="list-grid">
        <article
          v-for="user in pagedHouseholds"
          :key="user.id"
          class="user-card"
          :class="{ selected: selectedIds.includes(user.id) }"
        >
          <div class="user-top">
            <div class="user-title-row">
              <label class="select-user">
                <input
                  type="checkbox"
                  :checked="selectedIds.includes(user.id)"
                  @change="toggleUserSelection(user.id, $event.target.checked)"
                />
              </label>

              <div>
                <div class="user-name">{{ user.name }}</div>
                <div class="user-meta">用户 ID {{ user.id }}</div>
              </div>
            </div>

            <div class="user-actions">
              <button class="ghost-btn compact" :disabled="loading" @click="openHistory(user)">历史汇总</button>
              <button class="ghost-btn compact" :disabled="loading || deletingUserId === user.id" @click="openEdit(user)">
                编辑
              </button>
              <button
                class="danger-btn compact"
                :disabled="loading || deletingUserId === user.id"
                @click="removeUser(user)"
              >
                {{ deletingUserId === user.id ? '删除中...' : '删除' }}
              </button>
            </div>
          </div>

          <div class="metric-grid">
            <div class="metric-card">
              <div class="metric-label">装机功率</div>
              <div class="metric-value">{{ formatNumber(user.capacity_kw) }} <span class="unit">kW</span></div>
            </div>
            <div class="metric-card">
              <div class="metric-label">电价</div>
              <div class="metric-value">¥{{ formatNumber(user.price_per_kwh) }} <span class="unit">元/度</span></div>
            </div>
          </div>
        </article>
      </section>

      <section class="pagination-card">
        <div class="toolbar-meta">
          <span>分页大小</span>
          <select v-model="pageSize" class="page-size-select" @change="resetToFirstPage">
            <option :value="4">4 条/页</option>
            <option :value="6">6 条/页</option>
            <option :value="8">8 条/页</option>
            <option :value="12">12 条/页</option>
          </select>
        </div>

        <div class="pagination-actions">
          <button class="ghost-btn compact" :disabled="currentPage === 1" @click="changePage(1)">第一页</button>
          <button class="ghost-btn compact" :disabled="currentPage === 1" @click="changePage(currentPage - 1)">上一页</button>
          <button class="ghost-btn compact" :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">下一页</button>
          <button class="ghost-btn compact" :disabled="currentPage === totalPages" @click="changePage(totalPages)">最后页</button>
        </div>
      </section>
    </template>

    <el-dialog
      :model-value="historyDialogVisible"
      width="760px"
      class="history-dialog"
      :show-close="false"
      align-center
      @update:model-value="closeHistory"
    >
      <template #header>
        <div class="dialog-header">
          <div>
            <div class="dialog-title">{{ historyData?.household?.name || '用户历史汇总' }}</div>
            <div class="dialog-sub">按月份汇总该用户历史发电数据，收益按当前电价估算。</div>
          </div>
          <button class="ghost-btn compact" @click="closeHistory">关闭</button>
        </div>
      </template>

      <div v-if="historyLoading" class="history-loading">正在加载历史汇总...</div>

      <div v-else-if="historyData" class="history-body">
        <div class="history-summary">
          <div class="history-stat">
            <div class="metric-label">累计月份</div>
            <div class="history-value">{{ historyData.totals.months }}</div>
          </div>
          <div class="history-stat">
            <div class="metric-label">累计发电量</div>
            <div class="history-value">{{ formatNumber(historyData.totals.totalKwh) }} <span class="unit">kWh</span></div>
          </div>
          <div class="history-stat">
            <div class="metric-label">累计收益估算</div>
            <div class="history-value money">¥{{ formatNumber(historyData.totals.estimatedAmount) }}</div>
          </div>
        </div>

        <div v-if="!historyData.months.length" class="history-empty">
          这个用户还没有历史发电记录，录入数据后这里会自动出现按月汇总。
        </div>

        <div v-else class="history-table">
          <div class="trend-card">
            <div class="trend-head">
              <div class="trend-title">月度趋势图</div>
              <div class="trend-sub">按月总发电量绘制，便于快速比较高低峰值。</div>
            </div>
            <div class="trend-chart">
              <div v-for="item in historyData.months" :key="`bar-${item.month}`" class="trend-bar-wrap">
                <div class="trend-value">{{ formatNumber(item.totalKwh) }}</div>
                <div class="trend-bar-rail">
                  <div
                    class="trend-bar-fill"
                    :style="{ height: `${historyChartMax ? Math.max((item.totalKwh / historyChartMax) * 100, 8) : 0}%` }"
                  ></div>
                </div>
                <div class="trend-label">{{ item.month.slice(5) }}月</div>
              </div>
            </div>
          </div>

          <div class="history-row history-head">
            <div>月份</div>
            <div>录入天数</div>
            <div>总发电量</div>
            <div>日均电量</div>
            <div>收益估算</div>
          </div>

          <div v-for="item in historyData.months" :key="item.month" class="history-row">
            <div>{{ formatMonth(item.month) }}</div>
            <div>{{ item.filledDays }} 天</div>
            <div>{{ formatNumber(item.totalKwh) }} kWh</div>
            <div>{{ formatNumber(item.avgDailyKwh) }} kWh</div>
            <div class="money">¥{{ formatNumber(item.estimatedAmount) }}</div>
          </div>
        </div>
      </div>
    </el-dialog>

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
  </div>
</template>

<style scoped>
.page{
  padding: 18px;
}

.hero{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap: 18px;
  padding: 20px;
  border-radius: 24px;
  background:
    radial-gradient(420px 140px at 15% 0%, rgba(59,130,246,.12), transparent 70%),
    radial-gradient(400px 160px at 90% 10%, rgba(236,72,153,.10), transparent 68%),
    rgba(255,255,255,.74);
  border: 1px solid rgba(15,23,42,.08);
  box-shadow: 0 18px 50px rgba(15,23,42,.10);
}

.hero-title{
  font-size: 28px;
  font-weight: 950;
  color:#0f172a;
}

.hero-sub{
  margin-top: 6px;
  font-size: 14px;
  color:#64748b;
}

.hero-actions{
  display:flex;
  align-items:flex-end;
  gap: 12px;
  flex-wrap: wrap;
  justify-content:flex-end;
}

.search-box{
  display:flex;
  flex-direction:column;
  gap: 6px;
  font-size: 12px;
  font-weight: 800;
  color:#64748b;
}

.search-box input,
.search-box select{
  width: 220px;
  height: 42px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.86);
  box-shadow: 0 8px 20px rgba(15,23,42,.06);
  color:#0f172a;
  font-weight: 700;
}

.summary{
  margin-top: 16px;
  display:grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.summary-card,
.toolbar-card,
.pagination-card,
.empty-card,
.user-card{
  border-radius: 20px;
  background: rgba(255,255,255,.78);
  border: 1px solid rgba(15,23,42,.08);
  box-shadow: 0 16px 40px rgba(15,23,42,.08);
}

.summary-card{
  padding: 16px 18px;
}

.summary-skeleton{
  margin-top: 8px;
  width: 72%;
  height: 24px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(226,232,240,.75), rgba(248,250,252,.98), rgba(226,232,240,.75));
  background-size: 200% 100%;
  animation: userSkeletonShift 1.4s ease-in-out infinite;
}

.summary-label,
.metric-label{
  font-size: 12px;
  color:#64748b;
}

.summary-value,
.metric-value{
  margin-top: 6px;
  font-size: 24px;
  font-weight: 950;
  color:#0f172a;
}

.summary-text{
  font-size: 18px;
}

.unit{
  margin-left: 4px;
  font-size: 12px;
  color:#64748b;
  font-weight: 800;
}

.error-banner{
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(254,242,242,.88);
  border: 1px solid rgba(220,38,38,.14);
  box-shadow: 0 10px 24px rgba(220,38,38,.08);
}

.error-title{
  font-size: 14px;
  font-weight: 900;
  color:#991b1b;
}

.error-text{
  margin-top: 4px;
  font-size: 13px;
  color:#b91c1c;
}

.empty-card{
  margin-top: 16px;
  padding: 40px 24px;
  text-align:center;
}

.empty-title{
  font-size: 22px;
  font-weight: 950;
  color:#0f172a;
}

.empty-text{
  width: min(560px, 100%);
  margin: 10px auto 0;
  font-size: 14px;
  line-height: 1.7;
  color:#64748b;
}

.empty-card .primary-btn,
.empty-card .ghost-btn{
  margin-top: 18px;
}

.toolbar-card,
.pagination-card{
  margin-top: 16px;
  padding: 16px 18px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.toolbar-meta{
  display:flex;
  align-items:center;
  gap: 12px;
  flex-wrap: wrap;
  color:#64748b;
  font-size: 13px;
  font-weight: 800;
}

.select-all,
.select-user{
  display:inline-flex;
  align-items:center;
  gap: 10px;
  color:#0f172a;
  font-weight: 900;
}

.select-all input,
.select-user input{
  width: 18px;
  height: 18px;
  accent-color: #4f46e5;
}

.list-grid{
  margin-top: 16px;
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.user-skeleton-grid{
  margin-top: 16px;
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.user-skeleton-card{
  border-radius: 20px;
  background: rgba(255,255,255,.78);
  border: 1px solid rgba(15,23,42,.08);
  box-shadow: 0 16px 40px rgba(15,23,42,.08);
  padding: 18px;
}

.user-skeleton-top,
.user-skeleton-actions,
.user-skeleton-metrics{
  display:flex;
  gap: 12px;
}

.user-skeleton-top{
  align-items:center;
  justify-content:space-between;
}

.user-skeleton-line,
.user-skeleton-pill,
.user-skeleton-box{
  background: linear-gradient(90deg, rgba(226,232,240,.75), rgba(248,250,252,.98), rgba(226,232,240,.75));
  background-size: 200% 100%;
  animation: userSkeletonShift 1.4s ease-in-out infinite;
}

.user-skeleton-line{
  height: 22px;
  border-radius: 999px;
}

.user-skeleton-line.large{
  width: 160px;
}

.user-skeleton-pill{
  width: 78px;
  height: 36px;
  border-radius: 999px;
}

.user-skeleton-metrics{
  margin-top: 16px;
}

.user-skeleton-box{
  flex: 1 1 0;
  height: 92px;
  border-radius: 16px;
}

@keyframes userSkeletonShift{
  0%{ background-position: 200% 0; }
  100%{ background-position: -200% 0; }
}

.user-card{
  padding: 18px;
}

.user-card.selected{
  border-color: rgba(79,70,229,.28);
  box-shadow: 0 18px 44px rgba(99,102,241,.14);
}

.user-top{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap: 12px;
}

.user-title-row{
  display:flex;
  align-items:flex-start;
  gap: 12px;
}

.user-name{
  font-size: 20px;
  font-weight: 950;
  color:#0f172a;
}

.user-meta{
  margin-top: 4px;
  font-size: 12px;
  color:#64748b;
  font-weight: 800;
}

.user-actions{
  display:flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content:flex-end;
}

.metric-grid{
  margin-top: 16px;
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric-card{
  padding: 14px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(239,246,255,.92), rgba(253,242,248,.88));
  border: 1px solid rgba(15,23,42,.06);
}

.primary-btn,
.ghost-btn,
.danger-btn{
  height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 900;
  cursor:pointer;
  transition: transform .15s ease, opacity .15s ease;
}

.primary-btn:hover,
.ghost-btn:hover,
.danger-btn:hover{
  transform: translateY(-1px);
}

.primary-btn:disabled,
.ghost-btn:disabled,
.danger-btn:disabled{
  cursor:not-allowed;
  opacity:.6;
  transform:none;
}

.primary-btn{
  border: none;
  color:#fff;
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
  box-shadow: 0 12px 24px rgba(99,102,241,.22);
}

.ghost-btn{
  border: 1px solid rgba(15,23,42,.10);
  color:#0f172a;
  background: rgba(255,255,255,.84);
  box-shadow: 0 8px 20px rgba(15,23,42,.06);
}

.danger-btn{
  border: 1px solid rgba(220,38,38,.16);
  color:#b91c1c;
  background: rgba(254,242,242,.9);
}

.compact{
  height: 36px;
  padding: 0 14px;
  font-size: 13px;
}

.page-size-select{
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.84);
  color:#0f172a;
  font-weight: 800;
}

.pagination-actions{
  display:flex;
  gap: 8px;
  flex-wrap: wrap;
}

.dialog-header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap: 16px;
}

.dialog-title{
  font-size: 20px;
  font-weight: 950;
  color:#0f172a;
}

.dialog-sub{
  margin-top: 6px;
  font-size: 13px;
  color:#64748b;
}

.history-loading,
.history-empty{
  padding: 24px 8px;
  text-align:center;
  font-size: 14px;
  color:#64748b;
}

.history-body{
  padding-top: 4px;
}

.history-summary{
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.history-stat{
  padding: 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(239,246,255,.92), rgba(253,242,248,.88));
  border: 1px solid rgba(15,23,42,.06);
}

.history-value{
  margin-top: 6px;
  font-size: 22px;
  font-weight: 950;
  color:#0f172a;
}

.money{
  color:#d33;
}

.history-table{
  margin-top: 16px;
  border-radius: 18px;
  overflow:hidden;
  border: 1px solid rgba(15,23,42,.08);
}

.trend-card{
  padding: 18px;
  background: rgba(248,250,252,.95);
  border-bottom: 1px solid rgba(15,23,42,.06);
}

.trend-head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.trend-title{
  font-size: 16px;
  font-weight: 950;
  color:#0f172a;
}

.trend-sub{
  font-size: 12px;
  color:#64748b;
}

.trend-chart{
  margin-top: 14px;
  display:grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(88px, 1fr);
  gap: 16px;
  align-items:end;
  min-height: 198px;
  overflow-x: auto;
}

.trend-bar-wrap{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap: 5px;
}

.trend-value{
  font-size: 15px;
  font-weight: 950;
  color:#1e293b;
  line-height: 1;
  letter-spacing: .2px;
}

.trend-bar-rail{
  width: 64px;
  height: 138px;
  display:flex;
  align-items:flex-end;
  justify-content:center;
  padding: 8px 0;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(219,234,254,.55), rgba(248,250,252,.9));
  border: 1px solid rgba(15,23,42,.06);
}

.trend-bar-fill{
  width: 40px;
  min-height: 8px;
  border-radius: 999px;
  background: linear-gradient(180deg, #60a5fa 0%, #4f46e5 100%);
  box-shadow: 0 12px 24px rgba(79,70,229,.18);
}

.trend-label{
  margin-top: 1px;
  font-size: 14px;
  font-weight: 950;
  color:#475569;
  line-height: 1;
  letter-spacing: .3px;
}

.history-row{
  display:grid;
  grid-template-columns: 1.2fr .8fr 1fr 1fr 1fr;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(255,255,255,.78);
  border-bottom: 1px solid rgba(15,23,42,.06);
  font-size: 14px;
  color:#334155;
}

.history-head{
  background: rgba(241,245,249,.95);
  font-weight: 900;
  color:#0f172a;
}

.history-row:last-child{
  border-bottom:none;
}

@media (max-width: 960px){
  .hero,
  .user-top,
  .user-title-row,
  .dialog-header,
  .trend-head{
    flex-direction:column;
    align-items:stretch;
  }

  .hero-actions{
    justify-content:flex-start;
  }

  .search-box input,
  .search-box select{
    width: min(100%, 320px);
  }

  .summary,
  .list-grid,
  .user-skeleton-grid,
  .metric-grid,
  .history-summary{
    grid-template-columns: 1fr;
  }

  .toolbar-card,
  .pagination-card{
    align-items:stretch;
  }

  .history-row{
    grid-template-columns: 1fr;
    gap: 6px;
  }
}
</style>
