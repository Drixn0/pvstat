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

      <div class="nav-right toolbar-shell">
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
          <div class="jump-row action-row">
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

        <div class="control-card create-card">
          <div class="label"><el-icon><Plus /></el-icon> 用户</div>
          <el-button class="ios-btn ios-btn-primary create-btn" :disabled="isPageBusy || loading" @click="$emit('create')">
            {{ canManage ? '新增用户' : '登录后新增' }}
          </el-button>
        </div>
      </div>
    </div>

    <div class="summary">
      <div class="summary-side">
        <div class="summary-card accent compact">
          <div class="summary-label">统计月份</div>
          <div v-if="loading" class="summary-skeleton summary-skeleton-value"></div>
          <div v-else class="summary-value">{{ monthLabel }}</div>
        </div>
        <div class="summary-card compact">
          <div class="summary-label">用户数量</div>
          <div v-if="loading" class="summary-skeleton summary-skeleton-value"></div>
          <div v-else class="summary-value">{{ householdsCount }}</div>
        </div>
        <div class="summary-card compact">
          <div class="summary-label">用户总功率</div>
          <div v-if="loading" class="summary-skeleton summary-skeleton-value"></div>
          <div v-else class="summary-value">
            {{ totalCapacityKw.toFixed(2) }} <span class="unit">kW</span>
          </div>
        </div>
      </div>

      <div class="summary-main">
        <div class="summary-card hero-card highlight emphasis">
          <div class="hero-meta">
            <div class="summary-label">{{ monthLabel }} 累计发电量</div>
            <div class="hero-note">本月累计总输出</div>
          </div>
          <div v-if="loading" class="summary-skeleton hero-skeleton"></div>
          <div v-else class="hero-value">
            {{ summaryMonthKwh.text }} <span class="unit">{{ summaryMonthKwh.unit }}</span>
          </div>
        </div>

        <div class="summary-card hero-card money-card emphasis">
          <div class="hero-meta">
            <div class="summary-label">{{ monthLabel }} 累计发电收益</div>
            <div class="hero-note">按当前电价估算</div>
          </div>
          <div v-if="loading" class="summary-skeleton hero-skeleton"></div>
          <div v-else class="hero-value money">
            {{ summaryMonthAmount.prefix }}{{ summaryMonthAmount.text }}
            <span class="unit">{{ summaryMonthAmount.unit }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.header-shell{
  margin-bottom: 10px;
  padding: 14px 16px 10px;
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
  gap: 14px;
  margin-bottom: 10px;
}

.app-title{
  font-size: 22px;
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
  align-items:stretch;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.toolbar-shell{
  padding: 4px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(244,247,255,.86), rgba(255,255,255,.78));
  border: 1px solid rgba(184,198,226,.28);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.92);
}

.control-card{
  min-height: 72px;
  padding: 6px 10px 8px;
  border-radius: 18px;
  background: rgba(255,255,255,.72);
  border: 1px solid rgba(184,198,226,.24);
  display:flex;
  flex-direction:column;
  justify-content:space-between;
}

.label{
  display:flex;
  align-items:center;
  gap: 6px;
  font-size: 11px;
  color: #64748b;
  margin-bottom: 3px;
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
.action-row{
  min-height: 36px;
}

.ios-btn{
  border-radius: 999px;
  height: 36px;
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
  width: 100%;
}

.create-card{
  min-width: 154px;
}

.summary{
  display:grid;
  grid-template-columns: minmax(260px, 1.1fr) minmax(420px, 2fr);
  gap: 10px;
}

.summary-side{
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.summary-main{
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.summary-card{
  border: 1px solid rgba(184,198,226,.30);
  background: rgba(248,250,255,.82);
  border-radius: 18px;
  padding: 10px 12px 11px;
  min-height: 74px;
  position: relative;
  overflow: hidden;
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

.summary-card.compact{
  min-height: 68px;
}

.hero-card{
  min-height: 96px;
  padding: 12px 14px 14px;
}

.summary-card.emphasis{
  box-shadow: 0 10px 24px rgba(78,111,196,.08);
}

.summary-card::after{
  content:'';
  position:absolute;
  inset:auto 0 0 0;
  height: 3px;
  opacity: .5;
  background: linear-gradient(90deg, rgba(96,132,255,.28), rgba(96,132,255,0));
}

.summary-card.money-card::after{
  background: linear-gradient(90deg, rgba(239,68,68,.28), rgba(239,68,68,0));
}

.summary-label{ font-size: 11px; color: #64748b; }

.hero-meta{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap: 10px;
}

.hero-note{
  font-size: 10px;
  color:#7b89a3;
  white-space: nowrap;
}

.summary-value{
  margin-top: 4px;
  font-size: 20px;
  font-weight: 900;
  color: #0f172a;
  line-height: 1.1;
}

.summary-value.money{ color:#d33; }
.unit{ font-size: 11px; color:#64748b; font-weight:700; margin-left:4px; }

.hero-value{
  margin-top: 12px;
  font-size: 30px;
  line-height: 1;
  font-weight: 950;
  color:#10203f;
}

.hero-value.money{
  color:#d33;
}

.summary-skeleton{
  margin-top: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(226,232,240,.75), rgba(248,250,252,.98), rgba(226,232,240,.75));
  background-size: 200% 100%;
  animation: skeletonShift 1.4s ease-in-out infinite;
}

.summary-skeleton-value{
  width: 72%;
  height: 20px;
}

.hero-skeleton{
  margin-top: 12px;
  width: 78%;
  height: 32px;
}

@keyframes skeletonShift{
  0%{ background-position: 200% 0; }
  100%{ background-position: -200% 0; }
}

@media (max-width: 1200px){
  .summary{
    grid-template-columns: 1fr;
  }

  .summary-side,
  .summary-main{
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 960px){
  .header-shell{
    padding: 12px 12px 10px;
  }

  .nav{
    flex-direction: column;
  }

  .nav-right{
    width: 100%;
    justify-content: flex-start;
  }

  .toolbar-shell{
    padding: 0;
    background: transparent;
    border: none;
    box-shadow: none;
  }

  .control-card,
  .create-card{
    width: 100%;
  }

  .jump-row{
    flex-wrap: wrap;
  }

  .summary-side,
  .summary-main{
    grid-template-columns: 1fr;
  }
}
</style>
