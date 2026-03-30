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

function handleUnauthInputIntent(event) {
  if (props.canManage) return
  event?.preventDefault?.()
  event?.stopPropagation?.()
  props.requestAuth('登录后才能录入发电数据')
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
      <div class="head-left">
        <div class="identity-card">
          <div class="identity-main">
            <div class="name-mark">{{ String(user.name || '?').slice(0, 1) }}</div>
            <div class="identity">
              <div class="eyebrow">{{ monthLabel }} 用户卡</div>
              <div class="name">{{ user.name }}</div>
              <div class="meta">
                <span class="pill">功率 {{ fmtZero(user.capacity_kw, 2) }} kW</span>
                <span class="pill">电价 {{ fmtZero(user.price_per_kwh, 2) }} 元/度</span>
              </div>
            </div>
          </div>

          <div class="inline-stats">
          <div class="mini-stat">
            <span class="mini-label">月发电</span>
            <strong>{{ getUserStats(user.id).monthTotalKwh.toFixed(2) }}</strong>
            <span class="mini-unit">kWh</span>
          </div>
          <div class="mini-stat">
            <span class="mini-label">每kW</span>
            <strong>{{ getUserStats(user.id).monthEqHours.toFixed(2) }}</strong>
            <span class="mini-unit">h</span>
          </div>
          <div class="mini-stat money">
            <span class="mini-label">月收益</span>
            <strong>¥{{ getUserStats(user.id).monthTotalAmount.toFixed(2) }}</strong>
            <span class="mini-unit">estimate</span>
          </div>
        </div>
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

    <div class="entry-shell">
      <div class="entry-head">
        <div class="entry-inline-title">{{ monthLabel }} 录入面板</div>
        <div class="entry-inline-sub">填写上方电量，下面两行自动联动计算。</div>
      </div>

      <div class="day-strip">
        <div class="day-col day-col-head">
          <div class="day-title">日</div>
          <div class="cell-box head-cell-box">
            <div class="cell-label head-cell-label">发电量</div>
            <div class="head-placeholder">电量</div>
          </div>
          <div class="cell-metric head-cell-metric">
            <span class="metric-label head-metric-label">每kW</span>
          </div>
          <div class="cell-metric head-cell-metric money">
            <span class="metric-label head-metric-label">金额</span>
          </div>
        </div>

        <div class="day-scroll" :ref="(el) => setScrollRef(user.id, el)">
          <div class="day-col" v-for="d in daysInMonth" :key="user.id + '-' + d">
            <div class="day-title">{{ Number(d) }}</div>

            <div class="cell-box" :class="{ saving: isCellSaving(user.id, d) }">
              <div class="cell-label">发电量</div>
              <el-input
                :ref="(instance) => setInputRef(d, instance)"
                v-model="user.days[d]"
                size="small"
                class="cell-input"
                inputmode="decimal"
              placeholder="0"
              :readonly="!canManage"
              :disabled="isPageBusy || isCellSaving(user.id, d)"
              @mousedown="handleUnauthInputIntent"
              @focus="!canManage ? requestAuth('登录后才能录入发电数据') : null"
              @blur="handleBlur(d)"
              @keydown.enter.prevent="handleEnter(d)"
            />
            </div>

            <div class="cell-metric">
              <span class="metric-label">每kW</span>
              <span class="metric-value">{{ isCellSaving(user.id, d) ? '保存中...' : getPerKw(user, d).toFixed(3) }}</span>
            </div>
            <div class="cell-metric money">
              <span class="metric-label">金额</span>
              <span class="metric-value">¥{{ getAmount(user, d).toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="hint">只需填“电量”，下面两行自动计算；回车自动保存并跳到下一个格子，失焦也会保存。</div>
  </div>
</template>

<style scoped>
.user-card{
  border-radius: 22px;
  padding: 10px;
  box-shadow: 0 10px 22px rgba(15,23,42,.07);
}

.card-head{
  display:flex;
  align-items:stretch;
  justify-content: space-between;
  gap: 12px;
  padding: 10px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(255,255,255,.88), rgba(244,248,255,.82));
  border: 1px solid rgba(15,23,42,.05);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.95);
}

.head-left{
  min-width: 0;
  flex: 1 1 auto;
}

.identity-card{
  display:flex;
  align-items:center;
  gap: 12px;
  height: 100%;
  padding: 2px 2px;
}

.identity-main{
  display:flex;
  align-items:flex-start;
  gap: 12px;
  min-width: 0;
}

.name-mark{
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius: 16px;
  font-size: 18px;
  font-weight: 900;
  color:#1d4ed8;
  background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(223,235,255,.96));
  border: 1px solid rgba(78,111,196,.14);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.95);
}

.identity{
  min-width: 0;
  padding-top: 2px;
}

.eyebrow{
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
  color:#6b7ea6;
}

.name{
  margin-top: 3px;
  font-size: 17px;
  font-weight: 950;
  color:#0f172a;
  line-height: 1.1;
}

.meta{
  display:flex;
  align-items:center;
  gap:6px;
  flex-wrap: wrap;
  min-width: 0;
  margin-top: 8px;
}

.pill{
  font-size: 10px;
  font-weight: 900;
  color:#0f172a;
  white-space: nowrap;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255,255,255,.68);
  border: 1px solid rgba(15,23,42,.08);
}

.inline-stats{
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: min(400px, 100%);
  gap:6px;
  padding-left: 10px;
  border-left: 1px solid rgba(184,198,226,.34);
}

.mini-stat{
  min-width: 0;
  padding: 9px 10px 8px;
  border-radius: 16px;
  background: rgba(255,255,255,.92);
  border: 1px solid rgba(184,198,226,.30);
  color:#0f172a;
}

.mini-stat.money strong{
  color:#d33;
}

.mini-label{
  display:block;
  font-size: 10px;
  font-weight: 700;
  color:#64748b;
}

.mini-stat strong{
  display:block;
  margin-top: 3px;
  font-size: 13px;
  line-height: 1.1;
}

.mini-unit{
  display:block;
  margin-top: 3px;
  font-size: 9px;
  font-weight: 700;
  color:#7a8aa8;
}

.entry-inline-title{
  font-size: 13px;
  font-weight: 900;
  color:#22314f;
}

.entry-inline-sub{
  margin-top: 3px;
  font-size: 11px;
  color:#64748b;
}

.card-actions{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  flex: 0 0 auto;
  gap: 8px;
  padding: 0;
  border-radius: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

.icon-pill{
  display:flex;
  align-items:center;
  gap: 6px;
  font-size: 12px;
  font-weight: 900;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.88);
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

.entry-shell{
  margin-top: 8px;
  padding: 8px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,.72), rgba(245,248,255,.90));
  border: 1px solid rgba(15,23,42,.05);
}

.entry-head{
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap: 10px;
  margin-bottom: 8px;
  padding: 0 2px;
}

.day-strip{
  display:flex;
  gap: 6px;
  align-items: stretch;
}

.day-col-head{
  width: 92px;
  flex: 0 0 92px;
  border: 1px solid rgba(15,23,42,.06);
  background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(249,251,255,.92));
  border-radius: 16px;
  padding: 8px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.92);
}

.day-scroll{
  display:grid;
  grid-auto-flow: column;
  grid-auto-columns: 86px;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}

.day-scroll::-webkit-scrollbar{ height: 10px; }
.day-scroll::-webkit-scrollbar-thumb{ background: rgba(15,23,42,.14); border-radius: 999px; }
.day-scroll::-webkit-scrollbar-track{ background: rgba(15,23,42,.05); border-radius: 999px; }

.day-col{
  border: 1px solid rgba(15,23,42,.06);
  background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(249,251,255,.92));
  border-radius: 16px;
  padding: 8px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.92);
}

.day-title{ font-size: 10px; color:#64748b; font-weight: 900; }

.cell-box{
  margin-top: 8px;
  padding: 5px 6px 6px;
  border-radius: 11px;
  background: linear-gradient(180deg, rgba(241,245,255,.94), rgba(255,255,255,.92));
  border: 1px solid rgba(184,198,226,.35);
}

.cell-box.saving{
  background: linear-gradient(180deg, rgba(232,242,255,.96), rgba(255,255,255,.94));
  border-color: rgba(59,130,246,.22);
}

.cell-label{
  margin-bottom: 4px;
  font-size: 9px;
  font-weight: 800;
  color:#6d7f9c;
  line-height: 1.1;
}

.head-cell-box{
  align-items:flex-start;
}

.head-cell-label{
  color:#6d7f9c;
}

.head-placeholder{
  min-height: 30px;
  display:flex;
  align-items:center;
  font-size: 10px;
  font-weight: 900;
  color:#334155;
  white-space: nowrap;
}

.cell-input{ margin-top: 0; }
.cell-input :deep(.el-input__wrapper){
  border-radius: 10px;
  background: rgba(255,255,255,.96);
  box-shadow: none;
  padding: 0 8px;
  border: 1px solid rgba(184,198,226,.35);
}

.cell-input :deep(input){
  text-align: right;
  font-weight: 900;
  color:#0f172a;
}

.cell-metric{
  margin-top: 4px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 9px;
  background: rgba(255,255,255,.74);
  min-height: 34px;
}

.metric-label{
  font-size: 9px;
  font-weight: 800;
  color:#7a8aa8;
  white-space: nowrap;
  flex: 0 0 auto;
}

.metric-value{
  text-align: right;
  font-size: 10px;
  font-weight: 900;
  color:#0f172a;
  white-space: nowrap;
  flex: 0 0 auto;
}

.cell-metric.money .metric-value{ color:#d33; }
.head-cell-metric{
  justify-content:flex-start;
}

.head-metric-label{
  font-size: 11px;
  font-weight: 900;
}

.head-cell-metric.money .head-metric-label{
  color:#ef4444;
}
.hint{ margin-top: 6px; font-size: 10px; color:#64748b; }
.unit{ font-size: 11px; color:#64748b; font-weight:700; margin-left:4px; }

@media (max-width: 1200px){
  .card-head{
    flex-direction: column;
  }

  .identity-card{
    flex-direction: column;
    align-items:flex-start;
  }

  .inline-stats{
    width: 100%;
    border-left: none;
    padding-left: 0;
    border-top: 1px solid rgba(184,198,226,.38);
    padding-top: 12px;
  }
}

@media (max-width: 820px){
  .identity-card{
    align-items:flex-start;
  }

  .identity-main{
    width: 100%;
  }

  .inline-stats{
    grid-template-columns: 1fr;
  }

  .entry-head{
    flex-direction: column;
    align-items:flex-start;
  }

  .card-actions{
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
