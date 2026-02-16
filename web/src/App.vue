<template>
  <div class="app-wrapper">
    <!-- Apple Keynote（浅色发布会风）Header + 企业级监控小组件（移动端优化） -->
    <header class="keynote-header light">
      <div class="space-bg"></div>

      <!-- 漂浮光源（浅色版） -->
      <div class="orb orb-a"></div>
      <div class="orb orb-b"></div>
      <div class="orb orb-c"></div>

      <!-- 细噪点 + 轻微扫描光 -->
      <div class="grain"></div>
      <div class="scanline"></div>

      <!-- 发丝线 -->
      <div class="hairline-top"></div>
      <div class="hairline-bottom"></div>

      <!-- 标题胶囊（双行 + 监控） -->
      <div class="title-wrap">
        <div class="title-glow"></div>

        <div class="title-pill">
          <div class="title-left">
            <div class="title-text">太阳能光伏发电统计系统</div>
            <div class="title-sub">财务统计版 · 自动计算电量 / 每kW / 金额</div>
          </div>

          <!-- 监控小组件 -->
          <div
            class="monitor"
            :class="monitorLevelClass"
            @mouseenter="showPopover = true"
            @mouseleave="showPopover = false"
            @click="togglePopover"
            role="button"
            tabindex="0"
            @keydown.enter="togglePopover"
            @keydown.space.prevent="togglePopover"
            title="点击查看监控详情"
          >
            <div class="mon-top">
              <span class="dot" :class="dotClass" aria-hidden="true"></span>
              <span class="mon-state">{{ stateText }}</span>

              <span class="sep">•</span>
              <span class="mon-latency" :class="{ bad: latencyMs != null && latencyMs > 1200 }">
                {{ latencyMs == null ? '— ms' : `${latencyMs} ms` }}
              </span>

              <span class="sep">•</span>
              <span class="mon-signal">{{ signalText }}</span>
            </div>

            <div class="mon-bottom">
              <span class="mon-small">上次：{{ lastCheckedText }}</span>
              <span class="sep">•</span>
              <span class="mon-small">失败：{{ failStreak }}</span>
            </div>

            <!-- 详情弹出面板 -->
            <transition name="fade-up">
              <div v-if="showPopover" class="popover" @click.stop>
                <div class="pop-title">
                  <span>服务监控</span>
                  <button class="pop-btn" @click="manualCheck" :disabled="checking">
                    {{ checking ? '检查中…' : '立即检查' }}
                  </button>
                </div>

                <div class="pop-grid">
                  <div class="pop-item">
                    <div class="k">状态</div>
                    <div class="v" :class="dotClass">{{ stateText }}</div>
                  </div>

                  <div class="pop-item">
                    <div class="k">延迟</div>
                    <div class="v">{{ latencyMs == null ? '—' : `${latencyMs} ms` }}</div>
                  </div>

                  <div class="pop-item">
                    <div class="k">后端版本</div>
                    <div class="v">{{ health?.version ?? '—' }}</div>
                  </div>

                  <div class="pop-item">
                    <div class="k">运行时长</div>
                    <div class="v">{{ uptimeText }}</div>
                  </div>

                  <div class="pop-item">
                    <div class="k">DB</div>
                    <div class="v" :class="{ ok: health?.checks?.db === true, bad: health?.checks?.db === false }">
                      {{ health?.checks?.db === true ? 'OK' : health?.checks?.db === false ? 'ERROR' : '—' }}
                    </div>
                  </div>

                  <div class="pop-item">
                    <div class="k">最近检查</div>
                    <div class="v">{{ lastCheckedFullText }}</div>
                  </div>
                </div>

                <div class="pop-foot">
                  <div class="note">
                    策略：在线 5s 检查；离线/失败自动退避（10s → 20s → 30s）。页面后台自动降频。
                  </div>

                  <div class="foot-actions">
                    <button class="ghost" @click="showPopover = false">关闭</button>
                  </div>
                </div>
              </div>
            </transition>
          </div>
          <!-- /监控小组件 -->
        </div>
      </div>
    </header>

    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

// const API_BASE = 'http://localhost:3000'
const API_BASE = ''

const checking = ref(false)
const state = ref('checking') // checking | online | offline
const latencyMs = ref(null)
const lastCheckedAt = ref(null)
const failStreak = ref(0)
const health = ref(null)

const showPopover = ref(false)

let timer = null
let currentIntervalMs = 5000
let visibilityFactor = 1
let aborter = null

function now() {
  return Date.now()
}

function fmtTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

const lastCheckedText = computed(() => fmtTime(lastCheckedAt.value))
const lastCheckedFullText = computed(() => {
  if (!lastCheckedAt.value) return '—'
  const d = new Date(lastCheckedAt.value)
  return d.toLocaleString()
})

const uptimeText = computed(() => {
  const sec = health.value?.uptimeSec
  if (typeof sec !== 'number') return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
})

const stateText = computed(() => {
  if (state.value === 'online') return '在线'
  if (state.value === 'offline') return '离线'
  return '同步中'
})

const dotClass = computed(() => {
  if (state.value === 'online') return 'online'
  if (state.value === 'offline') return 'offline'
  return 'checking'
})

const signalText = computed(() => {
  if (state.value !== 'online') return '—'
  const ms = latencyMs.value
  if (ms == null) return '—'
  if (ms <= 180) return '极佳'
  if (ms <= 450) return '良好'
  if (ms <= 900) return '一般'
  return '较差'
})

const monitorLevelClass = computed(() => {
  if (state.value === 'offline') return 'level-bad'
  if (state.value === 'checking') return 'level-warn'
  const ms = latencyMs.value ?? 0
  if (ms > 1200) return 'level-warn'
  return 'level-ok'
})

function scheduleNext() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    checkHealth()
  }, Math.round(currentIntervalMs * visibilityFactor))
}

function computeBackoffMs(streak) {
  if (streak <= 0) return 5000
  if (streak === 1) return 10000
  if (streak === 2) return 20000
  return 30000
}

async function checkHealth() {
  if (checking.value) return
  checking.value = true
  state.value = 'checking'

  if (aborter) aborter.abort()
  aborter = new AbortController()

  const started = performance.now()
  try {
    const res = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: aborter.signal
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    health.value = data

    const ended = performance.now()
    latencyMs.value = Math.round(ended - started)

    lastCheckedAt.value = now()
    failStreak.value = 0
    state.value = 'online'
    currentIntervalMs = 5000
  } catch (e) {
    lastCheckedAt.value = now()
    latencyMs.value = null
    failStreak.value += 1
    state.value = 'offline'
    currentIntervalMs = computeBackoffMs(failStreak.value)
  } finally {
    checking.value = false
    scheduleNext()
  }
}

function manualCheck() {
  checkHealth()
}

function togglePopover() {
  showPopover.value = !showPopover.value
}

function onVisibilityChange() {
  visibilityFactor = document.hidden ? 2 : 1
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  onVisibilityChange()
  checkHealth()
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  clearTimeout(timer)
  if (aborter) aborter.abort()
})
</script>

<style scoped>
/* ✅ 浅色发布会背景 */
.app-wrapper{
  min-height: 100vh;
  background:
    radial-gradient(1200px 700px at 20% -10%, rgba(99,102,241,.18), transparent 60%),
    radial-gradient(1000px 600px at 90% 0%, rgba(236,72,153,.14), transparent 55%),
    radial-gradient(900px 700px at 50% 105%, rgba(34,211,238,.10), transparent 55%),
    #f6f7fb;
}

.app-main{
  padding: 18px;
}

/* ========== Keynote Header（移动端优化：高度自适应 + 安全区）========== */
.keynote-header{
  position: relative;
  padding: calc(10px + env(safe-area-inset-top)) 14px 12px;
  overflow: hidden;
  border-radius: 0 0 28px 28px;
}
.keynote-header.light{
  background: rgba(255,255,255,.62);
  backdrop-filter: blur(26px) saturate(170%);
  -webkit-backdrop-filter: blur(26px) saturate(170%);
  border-bottom: 1px solid rgba(15,23,42,.08);
  box-shadow:
    0 18px 60px rgba(15,23,42,.10),
    0 6px 18px rgba(15,23,42,.06);
}

.space-bg{
  position:absolute;
  inset:-40px;
  background:
    radial-gradient(900px 260px at 50% -10%, rgba(255,255,255,.75), transparent 70%),
    radial-gradient(900px 420px at 20% 10%, rgba(99,102,241,.18), transparent 62%),
    radial-gradient(900px 420px at 80% 20%, rgba(236,72,153,.14), transparent 64%),
    radial-gradient(1000px 520px at 50% 120%, rgba(34,211,238,.10), transparent 58%);
  opacity: .95;
  pointer-events:none;
}

.orb{
  position:absolute;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  filter: blur(44px);
  opacity: .30;
  transform: translate3d(0,0,0);
  pointer-events:none;
}
.orb-a{ left: -240px; top: -460px; background: radial-gradient(circle at 30% 30%, rgba(99,102,241,.80), transparent 60%); animation: orbFloatA 10s ease-in-out infinite alternate; }
.orb-b{ right: -260px; top: -500px; background: radial-gradient(circle at 60% 40%, rgba(236,72,153,.60), transparent 62%); animation: orbFloatB 12s ease-in-out infinite alternate; }
.orb-c{ left: 50%; top: -580px; transform: translateX(-50%); background: radial-gradient(circle at 50% 60%, rgba(34,211,238,.48), transparent 64%); animation: orbFloatC 14s ease-in-out infinite alternate; }

.grain{
  position:absolute;
  inset:0;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='.35'/%3E%3C/svg%3E");
  opacity: .035;
  mix-blend-mode: overlay;
  pointer-events:none;
}

.scanline{
  position:absolute;
  left:-20%;
  top:-48%;
  width:140%;
  height:240%;
  background: linear-gradient(
    120deg,
    transparent 0%,
    rgba(255,255,255,.08) 45%,
    rgba(255,255,255,.14) 50%,
    rgba(255,255,255,.08) 55%,
    transparent 100%
  );
  transform: translateX(-18%);
  opacity: .55;
  filter: blur(2px);
  animation: scanMove 9s ease-in-out infinite alternate;
  pointer-events:none;
}

.hairline-top,
.hairline-bottom{
  position:absolute;
  left:0; right:0;
  height:1px;
  pointer-events:none;
}
.hairline-top{ top:0; background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent); opacity:.9; }
.hairline-bottom{ bottom:0; background: linear-gradient(90deg, transparent, rgba(15,23,42,.12), transparent); opacity:.7; }

.title-wrap{
  position: relative;
  z-index: 5;
  display:flex;
  align-items:center;
  justify-content:center;
}

.title-glow{
  position:absolute;
  width: min(720px, 92vw);
  height: 160px;
  background: radial-gradient(circle at 50% 50%, rgba(99,102,241,.14), transparent 70%);
  filter: blur(18px);
  opacity: .9;
  pointer-events:none;
}

.title-pill{
  position: relative;
  width: min(1080px, 100%);
  padding: 12px 14px;
  border-radius: 22px;
  background: rgba(255,255,255,.66);
  border: 1px solid rgba(15,23,42,.08);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.8),
    0 16px 44px rgba(15,23,42,.10),
    0 6px 16px rgba(15,23,42,.06);
  overflow:hidden;

  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 12px;
}

.title-pill::before{
  content:"";
  position:absolute;
  inset:-45% -55%;
  background: linear-gradient(
    120deg,
    transparent 0%,
    rgba(99,102,241,.10) 42%,
    rgba(34,211,238,.10) 50%,
    rgba(236,72,153,.08) 58%,
    transparent 100%
  );
  transform: translateX(-25%);
  opacity: .45;
  animation: pillSheen 7s ease-in-out infinite alternate;
  pointer-events:none;
}

.title-left{ position: relative; z-index: 1; min-width: 0; }
.title-text{
  font-size: clamp(16px, 4.6vw, 20px);
  font-weight: 900;
  letter-spacing: .7px;
  line-height: 1.08;
  background: linear-gradient(90deg,#0b1220 0%,#1f2a44 28%,#0b1220 55%,#233a64 78%,#0b1220 100%);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 14px rgba(99,102,241,.14), 0 0 28px rgba(34,211,238,.08);
  animation: titleShift 6.5s ease-in-out infinite;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.title-sub{
  margin-top: 4px;
  font-size: clamp(11px, 3.2vw, 12px);
  font-weight: 800;
  color: rgba(15,23,42,.55);
  letter-spacing: .2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.monitor{
  position: relative;
  z-index: 2;
  flex: 0 0 auto;

  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(15,23,42,.035);
  border: 1px solid rgba(15,23,42,.06);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.55);
  cursor: pointer;
  user-select: none;
  min-width: 230px;
}

.mon-top{ display:flex; align-items:center; gap: 8px; white-space: nowrap; }
.mon-bottom{ margin-top: 6px; display:flex; align-items:center; gap: 8px; color: rgba(15,23,42,.55); font-weight: 800; }

.mon-state{ font-size: 12px; font-weight: 1000; color: rgba(15,23,42,.78); }
.mon-latency{ font-size: 12px; font-weight: 1000; color: rgba(15,23,42,.72); }
.mon-latency.bad{ color: #b45309; }
.mon-signal{ font-size: 12px; font-weight: 1000; color: rgba(15,23,42,.65); }
.mon-small{ font-size: 12px; font-weight: 900; }
.sep{ opacity: .5; font-weight: 900; }

.monitor.level-ok{ border-color: rgba(34,197,94,.22); }
.monitor.level-warn{ border-color: rgba(245,158,11,.28); }
.monitor.level-bad{ border-color: rgba(239,68,68,.28); }

.dot{ width: 9px; height: 9px; border-radius: 50%; transition: all .25s ease; }
.dot.online{ background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.18), 0 0 18px rgba(34,197,94,.35); animation: dotPulse 1.6s ease-in-out infinite; }
.dot.offline{ background: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,.16); }
.dot.checking{ background: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.16); animation: dotSpin 1.2s linear infinite; }

.popover{
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  width: 360px;
  border-radius: 18px;
  background: rgba(255,255,255,.82);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  border: 1px solid rgba(15,23,42,.10);
  box-shadow: 0 26px 70px rgba(15,23,42,.20);
  padding: 12px;
}

.pop-title{ display:flex; align-items:center; justify-content: space-between; gap: 10px; padding: 6px 6px 10px; border-bottom: 1px solid rgba(15,23,42,.06); margin-bottom: 10px; font-weight: 1000; color: rgba(15,23,42,.85); }
.pop-btn{ border: 1px solid rgba(15,23,42,.10); background: rgba(255,255,255,.75); border-radius: 12px; padding: 8px 10px; font-weight: 1000; cursor: pointer; }
.pop-btn:disabled{ opacity: .6; cursor: not-allowed; }

.pop-grid{ display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.pop-item{ border: 1px solid rgba(15,23,42,.06); background: rgba(255,255,255,.75); border-radius: 14px; padding: 10px; }
.pop-item .k{ font-size: 12px; color: rgba(15,23,42,.55); font-weight: 900; }
.pop-item .v{ margin-top: 6px; font-size: 13px; font-weight: 1000; color: rgba(15,23,42,.85); }
.pop-item .v.ok{ color: #15803d; }
.pop-item .v.bad{ color: #b91c1c; }
.pop-item .v.online{ color: #15803d; }
.pop-item .v.offline{ color: #b91c1c; }
.pop-item .v.checking{ color: #1d4ed8; }

.pop-foot{ margin-top: 10px; border-top: 1px solid rgba(15,23,42,.06); padding-top: 10px; }
.note{ font-size: 12px; color: rgba(15,23,42,.55); font-weight: 800; line-height: 1.4; }
.foot-actions{ margin-top: 10px; display:flex; justify-content:flex-end; }
.ghost{ border: 1px solid rgba(15,23,42,.10); background: transparent; border-radius: 12px; padding: 8px 12px; font-weight: 1000; cursor: pointer; }

.fade-up-enter-active, .fade-up-leave-active{ transition: all .18s ease; }
.fade-up-enter-from, .fade-up-leave-to{ opacity: 0; transform: translateY(-6px); }

@keyframes orbFloatA{ 0%{transform:translate(0,0)} 100%{transform:translate(60px,22px)} }
@keyframes orbFloatB{ 0%{transform:translate(0,0)} 100%{transform:translate(-70px,28px)} }
@keyframes orbFloatC{ 0%{transform:translateX(-50%) translateY(0)} 100%{transform:translateX(-50%) translateY(30px)} }
@keyframes scanMove{ 0%{transform:translateX(-18%)} 100%{transform:translateX(18%)} }
@keyframes pillSheen{ 0%{transform:translateX(-25%)} 100%{transform:translateX(25%)} }
@keyframes titleShift{ 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes dotPulse{ 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.08);opacity:.85} }
@keyframes dotSpin{ 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }

@media (prefers-reduced-motion: reduce){
  .orb, .scanline, .title-text, .title-pill::before, .dot{ animation: none !important; }
}

/* ====== 关键：移动端不挤压（让 pill 自动换行 + 监控块全宽）====== */
@media (max-width: 860px){
  .title-pill{
    flex-direction: column;
    align-items: stretch;
  }
  .monitor{
    min-width: 0;
    width: 100%;
  }
  .mon-top{
    justify-content: space-between;
  }
  .popover{
    width: min(360px, calc(100vw - 28px));
    right: 0;
  }
}

@media (max-width: 420px){
  .app-main{ padding: 12px; }
  .title-pill{ padding: 12px; border-radius: 18px; }
}
</style>
