<script setup>
import { ElButton, ElDialog, ElInput } from 'element-plus'

defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  promptMessage: {
    type: String,
    default: ''
  },
  form: {
    type: Object,
    required: true
  }
})

defineEmits(['update:modelValue', 'submit'])
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="460px"
    class="auth-dialog"
    :show-close="false"
    align-center
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="dialog-header">
        <div>
          <div class="dialog-title">管理员登录</div>
          <div class="dialog-sub">{{ promptMessage || '登录后才能修改系统数据。' }}</div>
        </div>
        <button class="dialog-close" @click="$emit('update:modelValue', false)">关闭</button>
      </div>
    </template>

    <div class="form-ios">
      <div class="form-row">
        <div class="form-label">用户名</div>
        <el-input v-model="form.username" class="ios-input" :disabled="loading" autocomplete="username" />
      </div>

      <div class="form-row">
        <div class="form-label">密码</div>
        <el-input
          v-model="form.password"
          type="password"
          show-password
          class="ios-input"
          :disabled="loading"
          autocomplete="current-password"
          @keyup.enter="$emit('submit')"
        />
      </div>

      <div class="form-actions">
        <el-button class="ios-btn" :disabled="loading" @click="$emit('update:modelValue', false)">取消</el-button>
        <el-button class="ios-btn ios-btn-primary" :loading="loading" @click="$emit('submit')">登录</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
:deep(.auth-dialog .el-dialog){
  border-radius: 24px;
  overflow: hidden;
  background: rgba(255,255,255,.72);
  backdrop-filter: blur(26px) saturate(170%);
  -webkit-backdrop-filter: blur(26px) saturate(170%);
  border: 1px solid rgba(15,23,42,.10);
  box-shadow:
    0 28px 80px rgba(15,23,42,.22),
    0 10px 26px rgba(15,23,42,.12);
}

:deep(.auth-dialog .el-dialog__header){ margin: 0; padding: 0; }
:deep(.auth-dialog .el-dialog__body){ padding: 0; }

.dialog-header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap: 16px;
  padding: 16px 18px 14px;
  border-bottom: 1px solid rgba(15,23,42,.06);
  background: linear-gradient(180deg, rgba(59,130,246,.10) 0%, rgba(236,72,153,.06) 50%, rgba(255,255,255,0) 100%);
}

.dialog-title{
  font-size: 18px;
  font-weight: 950;
  color:#0f172a;
}

.dialog-sub{
  margin-top: 6px;
  font-size: 13px;
  color:#64748b;
  line-height: 1.6;
}

.dialog-close{
  border: 1px solid rgba(15,23,42,.08);
  background: rgba(255,255,255,.70);
  border-radius: 999px;
  padding: 8px 12px;
  font-weight: 950;
  color:#2563eb;
  cursor: pointer;
}

.form-ios{
  padding: 16px 16px 18px;
}

.form-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 14px;
  padding: 14px;
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
  width: 72px;
  flex: 0 0 72px;
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

.form-actions{
  display:flex;
  justify-content:flex-end;
  gap: 12px;
  margin-top: 6px;
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
