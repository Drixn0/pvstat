<script setup>
import { ElButton, ElIcon } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

defineProps({
  kind: {
    type: String,
    required: true
  },
  monthLabel: {
    type: String,
    default: ''
  }
})

defineEmits(['primary', 'secondary'])
</script>

<template>
  <div v-if="kind === 'no-users'" class="empty-state">
    <div class="empty-visual solar">
      <div class="sun-core"></div>
      <div class="sun-ring"></div>
      <div class="panel-grid">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
    <div class="empty-title">还没有用户数据</div>
    <div class="empty-text">先新增一个用户，系统就会开始记录每日电量、自动计算每kW发电量和收益。</div>
    <div class="empty-actions">
      <el-button class="ios-btn ios-btn-primary" @click="$emit('primary')">
        <el-icon><Plus /></el-icon>
        立即新增用户
      </el-button>
    </div>
  </div>

  <div v-else class="empty-state month-empty">
    <div class="empty-visual timeline">
      <div class="timeline-dot"></div>
      <div class="timeline-line"></div>
      <div class="timeline-cards">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
    <div class="empty-title">{{ monthLabel }} 还没有录入发电数据</div>
    <div class="empty-text">用户已经准备好了，现在只需要在下方卡片里录入每天电量，本月合计和收益会自动生成。</div>
    <div class="empty-actions">
      <el-button class="ios-btn" @click="$emit('secondary')">跳到 1 日</el-button>
      <el-button class="ios-btn ios-btn-primary" @click="$emit('primary')">定位今日</el-button>
    </div>
  </div>
</template>

<style scoped>
.empty-state{
  margin: 14px 0;
  padding: 34px 24px;
  border-radius: 24px;
  background:
    radial-gradient(600px 240px at 15% 0%, rgba(59,130,246,.12), transparent 60%),
    radial-gradient(520px 240px at 85% 10%, rgba(236,72,153,.10), transparent 58%),
    rgba(255,255,255,.78);
  border: 1px solid rgba(15,23,42,.08);
  box-shadow: 0 18px 50px rgba(15,23,42,.10);
  text-align: center;
}

.empty-visual{
  position: relative;
  margin: 0 auto 18px;
}

.empty-title{
  font-size: 22px;
  font-weight: 950;
  color: #0f172a;
}

.empty-text{
  width: min(560px, 100%);
  margin: 10px auto 0;
  font-size: 14px;
  line-height: 1.7;
  color: #64748b;
}

.empty-actions{
  margin-top: 18px;
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.empty-visual.solar{
  width: 170px;
  height: 110px;
}

.sun-core{
  position: absolute;
  top: 0;
  left: 50%;
  width: 52px;
  height: 52px;
  transform: translateX(-50%);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff7cc 0%, #fbbf24 55%, #f59e0b 100%);
  box-shadow: 0 0 30px rgba(251,191,36,.35);
}

.sun-ring{
  position: absolute;
  top: -8px;
  left: 50%;
  width: 68px;
  height: 68px;
  transform: translateX(-50%);
  border-radius: 50%;
  border: 2px solid rgba(251,191,36,.25);
}

.panel-grid{
  position: absolute;
  left: 50%;
  bottom: 8px;
  width: 120px;
  height: 48px;
  transform: translateX(-50%) perspective(120px) rotateX(38deg);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(59,130,246,.92), rgba(37,99,235,.96));
  box-shadow: 0 14px 26px rgba(37,99,235,.22);
  overflow: hidden;
}

.panel-grid span{
  position: absolute;
  inset: 0;
  border-top: 1px solid rgba(255,255,255,.22);
  border-left: 1px solid rgba(255,255,255,.18);
}

.panel-grid span:nth-child(1){ transform: translateX(25%); }
.panel-grid span:nth-child(2){ transform: translateX(50%); }
.panel-grid span:nth-child(3){ transform: translateY(33%); }
.panel-grid span:nth-child(4){ transform: translateY(66%); }

.empty-visual.timeline{
  width: 200px;
  height: 92px;
}

.timeline-dot{
  position: absolute;
  left: 24px;
  top: 8px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #22c55e, #14b8a6);
  box-shadow: 0 0 0 8px rgba(20,184,166,.10);
}

.timeline-line{
  position: absolute;
  left: 31px;
  top: 24px;
  width: 2px;
  height: 52px;
  background: linear-gradient(180deg, rgba(20,184,166,.45), rgba(59,130,246,.12));
}

.timeline-cards{
  position: absolute;
  left: 58px;
  right: 0;
  top: 2px;
  display: grid;
  gap: 10px;
}

.timeline-cards span{
  display: block;
  height: 18px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(255,255,255,.85), rgba(191,219,254,.92));
  border: 1px solid rgba(59,130,246,.10);
  box-shadow: 0 10px 20px rgba(15,23,42,.05);
}

.timeline-cards span:nth-child(1){ width: 116px; }
.timeline-cards span:nth-child(2){ width: 88px; }
.timeline-cards span:nth-child(3){ width: 136px; }

.ios-btn{
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.10);
  background: rgba(255,255,255,.78);
  box-shadow: 0 6px 16px rgba(15,23,42,.06);
}

.ios-btn-primary{
  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%) !important;
  border: none !important;
  color: #fff !important;
}

@media (max-width: 820px){
  .empty-state{ padding: 28px 18px; }
  .empty-title{ font-size: 18px; }
}
</style>
