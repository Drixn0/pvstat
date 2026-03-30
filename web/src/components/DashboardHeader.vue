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
  <section class="header-shell">
    <div class="nav">
      <div class="nav-left">
        <div class="app-title">{{ monthLabel }} 发电录入工作台</div>
        <div class="app-sub">顶部看全局，下面直接连续录入，减少来回切换和视线负担。</div>
      </div>

      <div class="nav-right">
        <div class="control-card month">
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

        <div class="control-card jump">
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
            <el-button class="ios-btn ios-btn-soft" :disabled="isPageBusy || loading" @click="$emit('export')">
              <el-icon><Download /></el-icon>
              导出
            </el-button>
            <el-button class="ios-btn ios-btn-primary" :disabled="isPageBusy" @click="$emit('today')">今日</el-button>
          </div>
        </div>

        <el-button class="ios-btn ios-btn-primary create-btn" :disabled="isPageBusy || loading" @click="$emit('create')">
          <el-icon><Plus /></el-icon>
          {{ canManage ? '新增用户' : '登录后新增' }}
        </el-button>
      </div>
    </div>

    <div class="summary">
      <div class="summary-card accent">
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
      <div class="summary-card highlight">
        <div class="summary-label">{{ monthLabel }} 累计发电量</div>
        <div v-if="loading" class="summary-skeleton summary-skeleton-value"></div>
        <div v-else class="summary-value">
          {{ summaryMonthKwh.text }} <span class="unit">{{ summaryMonthKwh.unit }}</span>
        </div>
      </div>
      <div class="summary-card highlight money-card">
        <div class="summary-label">{{ monthLabel }} 累计发电收益</div>
        <div v-if="loading" class="summary-skeleton summary-skeleton-value"></div>
        <div v-else class="summary-value money">
          {{ summaryMonthAmount.prefix }}{{ summaryMonthAmount.text }}
          <span class="unit">{{ summaryMonthAmount.unit }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.header-shell{
  margin-bottom: 10px;
  padding: 18px 18px 14px;
  border-radius: 24px;
  border: 1px solid rgba(15,23,42,.05);
  background: linear-gradient(180deg, rgba(255,255,255,.84), rgba(255,255,255,.68));
  box-shadow: 0 14px 34px rgba(15,23,42,.06);
  backdrop-filter: blur(12px);
}

.nav{
  display:flex;
  align-items:flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 12px;
}

.app-title{
  font-size: 24px;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: .2px;
}

.app-sub{
  margin-top: 6px;
  font-size: 13px;
  color: #64748b;
}

.nav-right{
  display:flex;
  align-items:flex-end;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.control-card{
  padding: 10px 12px;
  border-radius: 18px;
  background: rgba(246,248,255,.78);
  border: 1px solid rgba(184,198,226,.35);
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
  border-radius: 14px;
  background: rgba(255,255,255,.94);
  border: 1px solid rgba(15,23,42,.06);
  box-shadow: none;
}

.ios-select{ width: 92px; }
.jump-row{ display:flex; gap:8px; align-items:center; }

.ios-btn{
  border-radius: 999px;
  height: 40px;
  border: 1px solid rgba(15,23,42,.08);
  background: rgba(255,255,255,.92);
  box-shadow: none;
}

.ios-btn:hover{ transform: translateY(-1px); transition: .15s; }

.ios-btn-soft{
  color:#3451a3;
  background: rgba(236,243,255,.96);
}

.ios-btn-primary{
  background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%) !important;
  border: none !important;
  color: #fff !important;
}

.create-btn{
  min-width: 126px;
}

.summary{
  display:grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.summary-card{
  border: 1px solid rgba(184,198,226,.30);
  background: rgba(248,250,255,.82);
  border-radius: 18px;
  padding: 12px 14px 13px;
  min-height: 86px;
}

.summary-card.accent{
  background: linear-gradient(135deg, rgba(237,242,255,.95), rgba(248,250,255,.86));
}

.summary-card.highlight{
  background: linear-gradient(135deg, rgba(235,243,255,.98), rgba(255,255,255,.9));
}

.summary-card.money-card{
  background: linear-gradient(135deg, rgba(255,243,244,.96), rgba(255,255,255,.92));
}

.summary-label{ font-size: 12px; color: #64748b; }

.summary-value{
  margin-top: 6px;
  font-size: 22px;
  font-weight: 900;
  color: #0f172a;
  line-height: 1.1;
}

.summary-value.money{ color:#d33; }
.unit{ font-size: 11px; color:#64748b; font-weight:700; margin-left:4px; }

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

@media (max-width: 960px){
  .header-shell{
    padding: 16px 14px 12px;
  }

  .nav{
    flex-direction: column;
  }

  .nav-right{
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
