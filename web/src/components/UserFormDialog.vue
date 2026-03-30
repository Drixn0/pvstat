<script setup>
import { ElButton, ElDialog, ElInput, ElInputNumber } from 'element-plus'

defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  form: {
    type: Object,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  namePlaceholder: {
    type: String,
    default: ''
  }
})

defineEmits(['update:modelValue', 'submit'])
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="520px"
    class="ios-dialog"
    :show-close="false"
    align-center
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-title">{{ title }}</div>
        <button class="dialog-close" @click="$emit('update:modelValue', false)">完成</button>
      </div>
    </template>

    <div class="form-ios">
      <div class="form-row">
        <div class="form-label">户名</div>
        <el-input v-model="form.name" class="ios-input" :disabled="loading" :placeholder="namePlaceholder" />
      </div>

      <div class="form-row">
        <div class="form-label">功率(kW)</div>
        <el-input-number v-model="form.capacity_kw" :min="0" :disabled="loading" controls-position="right" class="ios-number" />
      </div>

      <div class="form-row">
        <div class="form-label">电价(元/度)</div>
        <el-input-number
          v-model="form.price_per_kwh"
          :min="0"
          :step="0.01"
          :precision="2"
          :disabled="loading"
          controls-position="right"
          class="ios-number"
        />
      </div>

      <div class="form-actions">
        <el-button class="ios-btn" :disabled="loading" @click="$emit('update:modelValue', false)">取消</el-button>
        <el-button class="ios-btn ios-btn-primary" :loading="loading" @click="$emit('submit')">保存</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
:deep(.ios-dialog .el-dialog){
  border-radius: 24px;
  overflow: hidden;
  background: rgba(255,255,255,.70);
  backdrop-filter: blur(26px) saturate(170%);
  -webkit-backdrop-filter: blur(26px) saturate(170%);
  border: 1px solid rgba(15,23,42,.10);
  box-shadow:
    0 28px 80px rgba(15,23,42,.22),
    0 10px 26px rgba(15,23,42,.12);
}

:deep(.ios-dialog .el-dialog__header){ margin: 0; padding: 0; }
:deep(.ios-dialog .el-dialog__body){ padding: 0; }

.dialog-header{
  position: relative;
  display:flex;
  align-items:center;
  justify-content: space-between;
  padding: 16px 18px 14px;
  border-bottom: 1px solid rgba(15,23,42,.06);
  background: linear-gradient(180deg, rgba(99,102,241,.10) 0%, rgba(236,72,153,.06) 50%, rgba(255,255,255,0) 100%);
}

.dialog-header::before{
  content:"";
  position:absolute;
  left:50%;
  top:-120px;
  transform: translateX(-50%);
  width: 760px;
  height: 260px;
  background: radial-gradient(circle at 50% 70%, rgba(99,102,241,.18), rgba(236,72,153,.10), transparent 70%);
  filter: blur(16px);
  pointer-events:none;
}

.dialog-title{
  position: relative;
  z-index: 1;
  font-size: 18px;
  font-weight: 950;
  color:#0f172a;
  letter-spacing: .2px;
}

.dialog-close{
  position: relative;
  z-index: 1;
  border: 1px solid rgba(15,23,42,.08);
  background: rgba(255,255,255,.70);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 999px;
  padding: 8px 12px;
  font-weight: 950;
  color:#2563eb;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
}

.form-ios{
  padding: 16px 16px 18px;
}

.form-row{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 14px;
  border-radius: 18px;
  background: rgba(255,255,255,.78);
  border: 1px solid rgba(15,23,42,.08);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.85),
    0 14px 30px rgba(15,23,42,.08);
  margin-bottom: 12px;
}

.form-label{
  font-size: 13px;
  font-weight: 950;
  color:#0f172a;
  width: 96px;
  flex: 0 0 96px;
  opacity: .92;
}

.ios-input{
  width: 100%;
}

.ios-input :deep(.el-input__wrapper){
  border-radius: 14px;
  background: rgba(15,23,42,.03);
  box-shadow: none;
  border: 1px solid rgba(15,23,42,.08);
  padding: 10px 12px;
}

.ios-input :deep(.el-input__inner){
  font-weight: 700;
  color: #0f172a;
}

.ios-number{
  width: 100%;
}

.ios-number :deep(.el-input__wrapper){
  border-radius: 14px;
  background: rgba(15,23,42,.03);
  box-shadow: none;
  border: 1px solid rgba(15,23,42,.08);
  padding: 10px 12px;
}

.ios-number :deep(.el-input-number__increase),
.ios-number :deep(.el-input-number__decrease){
  display: none !important;
}

.ios-number :deep(.el-input-number .el-input__wrapper){
  padding-right: 12px;
}

.form-actions{
  display:flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 6px;
  padding-top: 6px;
}

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
</style>
