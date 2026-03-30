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
      <div class="total-strip">
        <div class="day-col day-col-head">
          <div class="day-title">日</div>
          <div class="row-title kwh">合计-发电量</div>
          <div class="row-title amount">合计-金额</div>
        </div>

        <div class="day-scroll" :ref="(el) => setScrollRef('TOTAL', el)">
          <div class="day-col" v-for="d in daysInMonth" :key="'TOTAL-' + d">
            <div class="day-title">{{ Number(d) }}</div>
            <div class="cell-text strong">{{ getDailyTotals(d).kwh.toFixed(2) }}</div>
            <div class="cell-text money strong">¥{{ getDailyTotals(d).amount.toFixed(2) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.total-card{
  margin-top: 10px;
  border: 1px solid rgba(15,23,42,.06);
  background: rgba(255,255,255,.76);
  backdrop-filter: blur(10px);
  border-radius: 22px;
  padding: 12px;
  box-shadow: 0 12px 28px rgba(15,23,42,.08);
}

.total-head{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 12px;
}

.total-title{ font-size: 17px; font-weight: 900; color:#0f172a; }
.total-sub{ margin-top: 4px; font-size: 12px; color:#64748b; }
.total-right{ display:flex; gap: 10px; flex-wrap: wrap; }
.total-kpi{
  min-width: 120px;
  padding: 8px 10px;
  border-radius: 16px;
  background: rgba(245,248,255,.88);
  border: 1px solid rgba(15,23,42,.05);
}
.total-kpi .kpi-label{ font-size: 11px; color:#64748b; }
.total-kpi .kpi-value{ margin-top: 4px; font-size: 14px; font-weight: 900; color:#0f172a; text-align:right; }
.total-kpi .kpi-value.money{ color:#d33; }

.total-shell{
  margin-top: 10px;
  padding: 10px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(255,255,255,.72), rgba(245,248,255,.90));
  border: 1px solid rgba(15,23,42,.05);
}

.total-strip{
  display:flex;
  gap: 8px;
  align-items: stretch;
}

.day-col-head{
  width: 98px;
  flex: 0 0 98px;
  border: 1px solid rgba(15,23,42,.06);
  background: rgba(255,255,255,.84);
  border-radius: 16px;
  padding: 10px 9px;
}

.row-title{ font-size: 11px; color:#64748b; margin-top: 10px; }
.row-title.kwh{ font-weight: 900; color:#334155; }
.row-title.amount{ color:#d33; font-weight: 900; }

.day-scroll{
  display:grid;
  grid-auto-flow: column;
  grid-auto-columns: 92px;
  gap: 8px;
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
  padding: 9px 9px 10px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.92);
}

.day-title{ font-size: 11px; color:#64748b; font-weight: 900; }

.cell-text{
  margin-top: 8px;
  text-align: right;
  font-size: 11px;
  font-weight: 900;
  color:#0f172a;
}

.cell-text.money{ color:#d33; }
.cell-text.strong{ font-weight: 1000; }
.unit{ font-size: 12px; color:#64748b; font-weight:700; margin-left:4px; }
</style>
