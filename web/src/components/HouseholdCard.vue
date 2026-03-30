<script setup>
import { nextTick } from 'vue'
import { ElIcon, ElInput } from 'element-plus'
import { Edit, Delete } from '@element-plus/icons-vue'

const props = defineProps({
  user: { type: Object, required: true },
  monthLabel: { type: String, required: true },
  daysInMonth: { type: Array, required: true },
  userStyle: { type: Object, required: true },
  isPageBusy: { type: Boolean, default: false },
  deleting: { type: Boolean, default: false },
  canManage: { type: Boolean, default: false },
  getUserStats: { type: Function, required: true },
  getPerKw: { type: Function, required: true },
  getAmount: { type: Function, required: true },
  fmtZero: { type: Function, required: true },
  isCellSaving: { type: Function, required: true },
  normalizeNumberInput: { type: Function, required: true },
  saveKwh: { type: Function, required: true },
  setScrollRef: { type: Function, required: true },
  requestAuth: { type: Function, required: true }
})

defineEmits(['edit', 'delete'])

const inputRefMap = new Map()
let skipBlurKey = ''

function setInputRef(day, instance) {
  if (instance) inputRefMap.set(day, instance)
  else inputRefMap.delete(day)
}

async function handleBlur(day) {
  if (!props.canManage) return
  const key = `${props.user.id}-${day}`
  if (skipBlurKey === key) {
    skipBlurKey = ''
    return
  }
  props.normalizeNumberInput(props.user, day)
  await props.saveKwh(props.user.id, day, props.user.days[day])
}

async function handleEnter(day) {
  if (!props.canManage) {
    props.requestAuth('登录后才能录入发电数据')
    return
  }
  const key = `${props.user.id}-${day}`
  skipBlurKey = key
  props.normalizeNumberInput(props.user, day)
  await props.saveKwh(props.user.id, day, props.user.days[day])

  const currentIndex = props.daysInMonth.indexOf(day)
  const nextDay = props.daysInMonth[currentIndex + 1]
  if (!nextDay) return

  await nextTick()
  const nextInput = inputRefMap.get(nextDay)
  nextInput?.focus?.()
  nextInput?.select?.()
}
</script>

<template>
  <div class="user-card" :style="userStyle">
    <div class="card-head">
      <div class="who">
        <div class="name">{{ user.name }}</div>
        <div class="meta">
          <span class="pill">功率 {{ fmtZero(user.capacity_kw, 2) }} kW</span>
          <span class="pill">电价 {{ fmtZero(user.price_per_kwh, 2) }} 元/度</span>
        </div>
      </div>

      <div class="card-actions">
        <button class="icon-pill" :disabled="isPageBusy || deleting" :title="canManage ? '编辑' : '登录后才能编辑'" @click="canManage ? $emit('edit', user) : requestAuth('登录后才能编辑用户')">
          <el-icon><Edit /></el-icon>
          编辑
        </button>
        <button class="icon-pill danger" :disabled="isPageBusy || deleting" :title="canManage ? '删除' : '登录后才能删除'" @click="canManage ? $emit('delete', user) : requestAuth('登录后才能删除用户')">
          <el-icon><Delete /></el-icon>
          {{ deleting ? '删除中...' : '删除' }}
        </button>
      </div>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-label">{{ monthLabel }} 总发电量</div>
        <div class="stat-value">{{ getUserStats(user.id).monthTotalKwh.toFixed(2) }} <span class="unit">kWh</span></div>
      </div>
      <div class="stat">
        <div class="stat-label">每kW发电量</div>
        <div class="stat-value">{{ getUserStats(user.id).monthEqHours.toFixed(2) }}</div>
      </div>
      <div class="stat">
        <div class="stat-label">{{ monthLabel }} 总收益</div>
        <div class="stat-value money">¥{{ getUserStats(user.id).monthTotalAmount.toFixed(2) }}</div>
      </div>
    </div>

    <div class="day-strip">
      <div class="day-col day-col-head">
        <div class="day-title">日</div>
        <div class="row-title kwh">电量</div>
        <div class="row-title perkw">每kW</div>
        <div class="row-title amount">金额</div>
      </div>

      <div class="day-scroll" :ref="(el) => setScrollRef(user.id, el)">
        <div class="day-col" v-for="d in daysInMonth" :key="user.id + '-' + d">
          <div class="day-title">{{ Number(d) }}</div>

          <el-input
            :ref="(instance) => setInputRef(d, instance)"
            v-model="user.days[d]"
            size="small"
            class="cell-input"
            inputmode="decimal"
            placeholder="0"
            :readonly="!canManage"
            :disabled="isPageBusy || isCellSaving(user.id, d)"
            @focus="!canManage ? requestAuth('登录后才能录入发电数据') : null"
            @blur="handleBlur(d)"
            @keydown.enter.prevent="handleEnter(d)"
          />

          <div class="cell-text">{{ isCellSaving(user.id, d) ? '保存中...' : getPerKw(user, d).toFixed(3) }}</div>
          <div class="cell-text money">¥{{ getAmount(user, d).toFixed(2) }}</div>
        </div>
      </div>
    </div>

    <div class="hint">只需填“电量”，下面两行自动计算；回车自动保存并跳到下一个格子，失焦也会保存。</div>
  </div>
</template>

<style scoped>
.user-card{
  border-radius: 18px;
  padding: 14px;
  box-shadow: 0 14px 34px rgba(15,23,42,.10);
}

.card-head{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: nowrap;
}

.who{
  display:flex;
  align-items:center;
  gap: 14px;
  min-width: 0;
  flex: 1 1 auto;
}

.name{
  font-size: 16px;
  font-weight: 950;
  color:#0f172a;
  white-space: nowrap;
  flex: 0 0 auto;
}

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

.card-actions{
  display:flex;
  align-items:center;
  gap: 10px;
  flex-shrink: 0;
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

.icon-pill:disabled{
  opacity: .6;
  cursor: not-allowed;
  transform: none;
}

.icon-pill:hover{ transform: translateY(-1px); transition: .15s; }
.icon-pill.danger{
  border: 1px solid rgba(220,38,38,.20);
  color: #b91c1c;
  background: rgba(254,242,242,.85);
}

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

.day-strip{
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

.cell-text{
  margin-top: 10px;
  text-align: right;
  font-size: 12px;
  font-weight: 900;
  color:#0f172a;
}

.cell-text.money{ color:#d33; }
.hint{ margin-top: 10px; font-size: 12px; color:#64748b; }
.unit{ font-size: 12px; color:#64748b; font-weight:700; margin-left:4px; }

@media (max-width: 1200px){
  .stats{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 820px){
  .card-head{ flex-wrap: wrap; align-items:flex-start; }
  .meta{ flex-wrap: wrap; }
  .card-actions{ width: 100%; justify-content: flex-end; }
}
</style>
