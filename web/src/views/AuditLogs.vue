<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchAuditLogs } from '../api/pvstat'
import { useAuth } from '../composables/useAuth'

const route = useRoute()
const router = useRouter()
const {
  isAuthenticated,
  openLoginDialog
} = useAuth()

const logs = ref([])
const total = ref(0)
const loading = ref(false)
const loadError = ref('')
const keyword = ref(String(route.query.keyword || ''))
const action = ref(String(route.query.action || ''))
const pageSize = ref([10, 20, 50].includes(Number(route.query.page_size)) ? Number(route.query.page_size) : 10)
const currentPage = ref(Math.max(1, Number(route.query.page || 1) || 1))

const actionOptions = [
  { value: '', label: '全部操作' },
  { value: 'LOGIN', label: '登录' },
  { value: 'HOUSEHOLD_CREATE', label: '新增用户' },
  { value: 'HOUSEHOLD_UPDATE', label: '编辑用户' },
  { value: 'HOUSEHOLD_DELETE', label: '删除用户' },
  { value: 'HOUSEHOLD_BATCH_DELETE', label: '批量删除' },
  { value: 'GENERATION_UPSERT', label: '录入发电量' }
]

const isInitialLoading = computed(() => loading.value && logs.value.length === 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const currentActionLabel = computed(() => {
  return actionOptions.find((item) => item.value === action.value)?.label || '全部操作'
})

function getErrorMessage(error, fallback = '加载操作日志失败') {
  return error?.response?.data?.error || error?.message || fallback
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function getActionLabel(value) {
  return actionOptions.find((item) => item.value === value)?.label || value || '未知操作'
}

function getStatusLabel(value) {
  return value === 'failed' ? '失败' : '成功'
}

function resetPage() {
  currentPage.value = 1
}

function changePage(page) {
  currentPage.value = Math.min(Math.max(1, page), totalPages.value)
}

function openLogin() {
  openLoginDialog('登录后才能查看操作日志')
}

async function loadLogs() {
  if (!isAuthenticated.value) {
    logs.value = []
    total.value = 0
    loadError.value = ''
    return
  }

  loading.value = true
  loadError.value = ''
  try {
    const data = await fetchAuditLogs({
      page: currentPage.value,
      page_size: pageSize.value,
      action: action.value || undefined,
      keyword: keyword.value.trim() || undefined
    })
    logs.value = data.items || []
    total.value = Number(data.total) || 0
    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value
      return
    }
  } catch (error) {
    logs.value = []
    total.value = 0
    loadError.value = getErrorMessage(error)
    ElMessage.error(loadError.value)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadLogs()
})

watch(
  () => isAuthenticated.value,
  async () => {
    resetPage()
    await loadLogs()
  }
)

watch([keyword, action, pageSize, currentPage], async () => {
  await router.replace({
    query: {
      ...route.query,
      keyword: keyword.value.trim() || undefined,
      action: action.value || undefined,
      page_size: pageSize.value !== 10 ? String(pageSize.value) : undefined,
      page: currentPage.value !== 1 ? String(currentPage.value) : undefined
    }
  })
  await loadLogs()
}, { flush: 'post' })
</script>

<template>
  <section class="audit-page">
    <div class="hero-card">
      <div>
        <div class="hero-title">操作日志</div>
        <div class="hero-sub">回看管理员登录、用户维护与发电录入记录，便于追踪关键操作。</div>
      </div>
      <button v-if="!isAuthenticated" class="hero-btn" @click="openLogin">
        管理员登录
      </button>
    </div>

    <section v-if="!isAuthenticated" class="readonly-card">
      <div>
        <div class="readonly-title">当前未登录</div>
        <div class="readonly-text">操作日志属于管理数据，登录后才能查看完整记录和筛选结果。</div>
      </div>
      <button class="readonly-btn" @click="openLogin">登录后查看</button>
    </section>

    <template v-else>
      <section class="summary-grid">
        <article class="summary-card">
          <div class="summary-label">日志总数</div>
          <div class="summary-value">{{ total }}</div>
        </article>
        <article class="summary-card">
          <div class="summary-label">当前筛选</div>
          <div class="summary-value compact">{{ currentActionLabel }}</div>
        </article>
        <article class="summary-card">
          <div class="summary-label">当前页</div>
          <div class="summary-value compact">{{ currentPage }} / {{ totalPages }}</div>
        </article>
      </section>

      <section class="toolbar-card">
        <label class="field">
          <span class="field-label">搜索</span>
          <input v-model="keyword" class="field-input" type="text" placeholder="搜索摘要或管理员用户名" @input="resetPage">
        </label>

        <label class="field">
          <span class="field-label">操作类型</span>
          <select v-model="action" class="field-input" @change="resetPage">
            <option v-for="item in actionOptions" :key="item.value || 'all'" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>

        <label class="field slim">
          <span class="field-label">每页</span>
          <select v-model="pageSize" class="field-input" @change="resetPage">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
          </select>
        </label>

        <button class="refresh-btn" @click="loadLogs" :disabled="loading">
          {{ loading ? '刷新中…' : '刷新日志' }}
        </button>
      </section>

      <section v-if="isInitialLoading" class="logs-card skeleton-wrap">
        <div v-for="index in 6" :key="index" class="skeleton-row"></div>
      </section>

      <section v-else class="logs-card">
        <div v-if="loadError" class="error-banner">
          <span>{{ loadError }}</span>
          <button class="retry-btn" @click="loadLogs">重试</button>
        </div>

        <div v-if="!logs.length" class="empty-state">
          <div class="empty-title">还没有匹配的操作日志</div>
          <div class="empty-text">可以换个筛选条件试试，或者先在首页和用户管理页做一次新增、编辑、录入操作。</div>
        </div>

        <div v-else class="table-wrap">
          <table class="log-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>管理员</th>
                <th>操作</th>
                <th>结果</th>
                <th>目标</th>
                <th>摘要</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in logs" :key="item.id">
                <td>{{ formatDateTime(item.created_at) }}</td>
                <td>{{ item.username || '—' }}</td>
                <td>
                  <span class="action-pill">{{ getActionLabel(item.action) }}</span>
                </td>
                <td>
                  <span class="status-pill" :class="{ failed: item.status === 'failed' }">
                    {{ getStatusLabel(item.status) }}
                  </span>
                </td>
                <td>{{ item.target_type || '—' }}{{ item.target_id ? ` / ${item.target_id}` : '' }}</td>
                <td class="summary-cell">{{ item.summary }}</td>
                <td>{{ item.client_ip || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="logs.length" class="pager">
          <button class="pager-btn" :disabled="currentPage <= 1 || loading" @click="changePage(currentPage - 1)">
            上一页
          </button>
          <div class="pager-text">第 {{ currentPage }} 页，共 {{ totalPages }} 页</div>
          <button class="pager-btn" :disabled="currentPage >= totalPages || loading" @click="changePage(currentPage + 1)">
            下一页
          </button>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.audit-page{
  display:grid;
  gap:20px;
}

.hero-card,
.readonly-card,
.summary-card,
.toolbar-card,
.logs-card{
  background:linear-gradient(135deg, rgba(255,255,255,0.92), rgba(244,247,255,0.88));
  border:1px solid rgba(183,198,226,0.32);
  box-shadow:0 18px 48px rgba(66, 94, 164, 0.08);
  border-radius:30px;
}

.hero-card{
  padding:24px 28px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:18px;
}

.hero-title{
  font-size:32px;
  line-height:1.1;
  font-weight:800;
  color:#14213d;
}

.hero-sub{
  margin-top:8px;
  color:#62748f;
  font-size:16px;
}

.hero-btn,
.readonly-btn,
.refresh-btn,
.retry-btn,
.pager-btn{
  border:none;
  border-radius:999px;
  font-weight:700;
  cursor:pointer;
}

.hero-btn,
.readonly-btn,
.refresh-btn,
.retry-btn{
  padding:12px 18px;
  color:#fff;
  background:linear-gradient(135deg, #5b8def, #4f46e5);
  box-shadow:0 14px 28px rgba(79, 70, 229, 0.22);
}

.readonly-card{
  padding:22px 24px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:16px;
  background:linear-gradient(135deg, rgba(255,248,234,0.96), rgba(255,255,255,0.92));
}

.readonly-title{
  font-size:20px;
  font-weight:800;
  color:#8a5a14;
}

.readonly-text{
  margin-top:6px;
  color:#9a6b1f;
  line-height:1.6;
}

.summary-grid{
  display:grid;
  gap:18px;
  grid-template-columns:repeat(3, minmax(0, 1fr));
}

.summary-card{
  padding:22px 24px;
}

.summary-label{
  color:#62748f;
  font-weight:700;
}

.summary-value{
  margin-top:10px;
  font-size:42px;
  font-weight:800;
  color:#14213d;
}

.summary-value.compact{
  font-size:26px;
}

.toolbar-card{
  padding:18px 20px;
  display:grid;
  gap:14px;
  grid-template-columns:minmax(0, 1.6fr) minmax(0, 1fr) 120px auto;
  align-items:end;
}

.field{
  display:grid;
  gap:8px;
}

.field.slim{
  max-width:120px;
}

.field-label{
  color:#62748f;
  font-size:14px;
  font-weight:700;
}

.field-input{
  width:100%;
  height:48px;
  padding:0 16px;
  border-radius:18px;
  border:1px solid rgba(183,198,226,0.42);
  background:rgba(255,255,255,0.92);
  color:#14213d;
  font-size:15px;
  outline:none;
}

.logs-card{
  padding:20px;
}

.skeleton-wrap{
  display:grid;
  gap:12px;
}

.skeleton-row{
  height:56px;
  border-radius:18px;
  background:linear-gradient(90deg, rgba(228,235,249,0.7), rgba(245,248,255,0.98), rgba(228,235,249,0.7));
  background-size:200% 100%;
  animation:shimmer 1.6s linear infinite;
}

.error-banner{
  margin-bottom:16px;
  padding:14px 16px;
  border-radius:18px;
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:center;
  background:rgba(255,241,242,0.96);
  color:#c2410c;
}

.empty-state{
  padding:44px 20px;
  text-align:center;
}

.empty-title{
  font-size:24px;
  font-weight:800;
  color:#14213d;
}

.empty-text{
  margin-top:8px;
  color:#62748f;
  line-height:1.7;
}

.table-wrap{
  overflow:auto;
}

.log-table{
  width:100%;
  border-collapse:collapse;
  min-width:980px;
}

.log-table th,
.log-table td{
  padding:16px 14px;
  border-bottom:1px solid rgba(220,228,241,0.75);
  text-align:left;
  vertical-align:top;
}

.log-table th{
  color:#62748f;
  font-size:14px;
  font-weight:800;
}

.log-table td{
  color:#22314f;
}

.summary-cell{
  min-width:260px;
}

.action-pill,
.status-pill{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:34px;
  padding:0 14px;
  border-radius:999px;
  font-size:13px;
  font-weight:800;
}

.action-pill{
  color:#3058b5;
  background:rgba(224, 238, 255, 0.95);
}

.status-pill{
  color:#0f7b53;
  background:rgba(221, 245, 235, 0.95);
}

.status-pill.failed{
  color:#c2410c;
  background:rgba(255, 234, 226, 0.96);
}

.pager{
  margin-top:18px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:14px;
}

.pager-btn{
  min-width:110px;
  height:46px;
  padding:0 18px;
  color:#14213d;
  background:#fff;
  border:1px solid rgba(183,198,226,0.42);
}

.pager-btn:disabled,
.refresh-btn:disabled{
  opacity:0.55;
  cursor:not-allowed;
}

.pager-text{
  color:#62748f;
  font-weight:700;
}

@keyframes shimmer{
  from{ background-position:200% 0; }
  to{ background-position:-200% 0; }
}

@media (max-width: 960px){
  .summary-grid,
  .toolbar-card{
    grid-template-columns:1fr;
  }

  .field.slim{
    max-width:none;
  }

  .hero-card,
  .readonly-card,
  .pager{
    align-items:flex-start;
    flex-direction:column;
  }

  .summary-value{
    font-size:34px;
  }
}
</style>
