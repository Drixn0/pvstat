<script setup>
defineProps({
  hasHouseholds: {
    type: Boolean,
    default: false
  },
  grandTotals: {
    type: Object,
    required: true
  },
  daysInMonth: {
    type: Array,
    required: true
  },
  getDailyTotals: {
    type: Function,
    required: true
  },
  setScrollRef: {
    type: Function,
    required: true
  }
})
</script>

<template>
  <div v-if="hasHouseholds" class="total-card">
    <div class="total-head">
      <div>
        <div class="total-title">合计</div>
        <div class="total-sub">按日汇总所有用户，方便快速核对整月走势。</div>
      </div>
      <div class="total-right">
        <div class="total-kpi">
          <div class="kpi-label">月总电量</div>
          <div class="kpi-value">{{ grandTotals.kwh.toFixed(2) }} <span class="unit">kWh</span></div>
        </div>
        <div class="total-kpi">
          <div class="kpi-label">月总金额</div>
          <div class="kpi-value money">¥{{ grandTotals.amount.toFixed(2) }}</div>
        </div>
      </div>
    </div>

    <div class="total-shell">
      <div class="total-shell-head">
        <div class="shell-note">每日总览</div>
        <div class="shell-legend">
          <span class="legend-item">蓝色为发电量</span>
          <span class="legend-item money">红色为金额</span>
        </div>
      </div>

      <div class="total-strip">
        <div class="day-col day-col-head">
          <div class="day-title">日</div>
          <div class="head-metric kwh">合计发电量</div>
          <div class="head-metric amount">合计金额</div>
        </div>

        <div class="day-scroll" :ref="(el) => setScrollRef('TOTAL', el)">
          <div class="day-col" v-for="d in daysInMonth" :key="'TOTAL-' + d">
            <div class="day-title">{{ Number(d) }}</div>
            <div class="metric-card">
              <span class="metric-caption">发电量</span>
              <span class="cell-text strong">{{ getDailyTotals(d).kwh.toFixed(2) }}</span>
            </div>
            <div class="metric-card money">
              <span class="metric-caption">金额</span>
              <span class="cell-text money strong">¥{{ getDailyTotals(d).amount.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.total-card{
  margin-top: 8px;
  border: 1px solid rgba(15,23,42,.06);
  background: rgba(255,255,255,.76);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 10px;
  box-shadow: 0 10px 22px rgba(15,23,42,.07);
}

.total-head{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 12px;
}

.total-title{ font-size: 17px; font-weight: 900; color:#0f172a; }
.total-sub{ margin-top: 3px; font-size: 11px; color:#64748b; }
.total-right{ display:flex; gap: 8px; flex-wrap: wrap; }
.total-kpi{
  min-width: 120px;
  padding: 7px 9px;
  border-radius: 14px;
  background: rgba(245,248,255,.88);
  border: 1px solid rgba(15,23,42,.05);
}
.total-kpi .kpi-label{ font-size: 10px; color:#64748b; }
.total-kpi .kpi-value{ margin-top: 3px; font-size: 13px; font-weight: 900; color:#0f172a; text-align:right; }
.total-kpi .kpi-value.money{ color:#d33; }

.total-shell{
  margin-top: 8px;
  padding: 8px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,.72), rgba(245,248,255,.90));
  border: 1px solid rgba(15,23,42,.05);
}

.total-shell-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;
  margin-bottom: 8px;
  padding: 0 2px;
}

.shell-note{
  font-size: 12px;
  font-weight: 900;
  color:#22314f;
}

.shell-legend{
  display:flex;
  align-items:center;
  gap: 8px;
  flex-wrap: wrap;
}

.legend-item{
  height: 24px;
  padding: 0 9px;
  display:flex;
  align-items:center;
  border-radius: 999px;
  background: rgba(255,255,255,.82);
  border: 1px solid rgba(184,198,226,.26);
  font-size: 10px;
  font-weight: 800;
  color:#4560a5;
}

.legend-item.money{
  color:#d33;
}

.total-strip{
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

.head-metric{
  margin-top: 8px;
  min-height: 30px;
  display:flex;
  align-items:center;
  padding: 4px 6px;
  border-radius: 9px;
  background: rgba(255,255,255,.74);
  font-size: 10px;
  font-weight: 900;
  color:#334155;
  white-space: nowrap;
}

.head-metric.amount{
  margin-top: 5px;
  color:#d33;
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

.metric-card{
  margin-top: 8px;
  min-height: 30px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 9px;
  background: rgba(255,255,255,.74);
}

.metric-card.money{
  margin-top: 4px;
}

.metric-caption{
  font-size: 9px;
  font-weight: 800;
  color:#7a8aa8;
  white-space: nowrap;
}

.cell-text{
  text-align: right;
  font-size: 10px;
  font-weight: 900;
  color:#0f172a;
  white-space: nowrap;
}

.cell-text.money{ color:#d33; }
.cell-text.strong{ font-weight: 1000; }
.unit{ font-size: 10px; color:#64748b; font-weight:700; margin-left:4px; }

@media (max-width: 960px){
  .total-shell-head{
    flex-direction: column;
    align-items:flex-start;
  }
}
</style>
