<script setup>
import { ElButton, ElDatePicker, ElIcon, ElOption, ElSelect } from 'element-plus'
import { Plus, Calendar, Aim, Download } from '@element-plus/icons-vue'

defineProps({
  month: {
    type: String,
    required: true
  },
  monthLabel: {
    type: String,
    required: true
  },
  jumpDay: {
    type: String,
    required: true
  },
  daysInMonth: {
    type: Array,
    required: true
  },
  isPageBusy: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  canManage: {
    type: Boolean,
    default: false
  },
  householdsCount: {
    type: Number,
    required: true
  },
  totalCapacityKw: {
    type: Number,
    required: true
  },
  summaryMonthKwh: {
    type: Object,
    required: true
  },
  summaryMonthAmount: {
    type: Object,
    required: true
  }
})

defineEmits(['update:month', 'update:jumpDay', 'month-change', 'jump', 'today', 'create', 'export'])
</script>

<template>
  <div>
    <div class="nav">
      <div class="nav-left">
        <div class="app-title">{{ monthLabel }} 光伏发电量及收益统计</div>
        <div class="app-sub">录入电量自动算每kW与金额</div>
      </div>

      <div class="nav-right">
        <div class="month">
          <div class="label"><el-icon><Calendar /></el-icon> 月份</div>
          <el-date-picker
            :model-value="month"
            type="month"
            format="M月"
            value-format="YYYY-MM"
            :clearable="false"
            :disabled="isPageBusy"
            class="ios-picker"
            @update:model-value="$emit('update:month', $event)"
            @change="$emit('month-change')"
          />
        </div>

        <div class="jump">
          <div class="label"><el-icon><Aim /></el-icon> 跳到</div>
          <div class="jump-row">
            <el-select
              :model-value="jumpDay"
              class="ios-select"
              :disabled="isPageBusy"
              @update:model-value="$emit('update:jumpDay', $event)"
              @change="$emit('jump', $event)"
            >
              <el-option v-for="d in daysInMonth" :key="'opt-' + d" :label="Number(d) + '日'" :value="d" />
            </el-select>

            <el-button class="ios-btn" :disabled="isPageBusy" @click="$emit('jump', jumpDay)">跳转</el-button>
            <el-button class="ios-btn ios-btn-primary" :disabled="isPageBusy" @click="$emit('today')">今日</el-button>
          </div>
        </div>

        <el-button class="ios-btn" :disabled="isPageBusy || loading" @click="$emit('export')">
          <el-icon><Download /></el-icon>
          导出明细
        </el-button>

        <el-button class="ios-btn ios-btn-primary" :disabled="isPageBusy || loading" @click="$emit('create')">
          <el-icon><Plus /></el-icon>
          {{ canManage ? '新增用户' : '登录后新增' }}
        </el-button>
      </div>
    </div>

    <div class="summary">
      <div class="summary-card">
        <div class="summary-label">统计月份</div>
        <div v-if="loading" class="summary-skeleton summary-skeleton-value"></div>
        <div v-else class="summary-value">{{ monthLabel }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">用户数量</div>
        <div v-if="loading" class="summary-skeleton summary-skeleton-value"></div>
        <div v-else class="summary-value">{{ householdsCount }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">用户总功率</div>
        <div v-if="loading" class="summary-skeleton summary-skeleton-value"></div>
        <div v-else class="summary-value">
          {{ totalCapacityKw.toFixed(2) }} <span class="unit">kW</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-label">{{ monthLabel }} 累计发电量</div>
        <div v-if="loading" class="summary-skeleton summary-skeleton-value"></div>
        <div v-else class="summary-value">
          {{ summaryMonthKwh.text }} <span class="unit">{{ summaryMonthKwh.unit }}</span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-label">{{ monthLabel }} 累计发电收益</div>
        <div v-if="loading" class="summary-skeleton summary-skeleton-value"></div>
        <div v-else class="summary-value money">
          {{ summaryMonthAmount.prefix }}{{ summaryMonthAmount.text }}
          <span class="unit">{{ summaryMonthAmount.unit }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  border-radius: 999px;
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

.summary-skeleton{
  margin-top: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(226,232,240,.75), rgba(248,250,252,.98), rgba(226,232,240,.75));
  background-size: 200% 100%;
  animation: skeletonShift 1.4s ease-in-out infinite;
}

.summary-skeleton-value{
  width: 72%;
  height: 24px;
}

@keyframes skeletonShift{
  0%{ background-position: 200% 0; }
  100%{ background-position: -200% 0; }
}

@media (max-width: 1200px){
  .summary{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
