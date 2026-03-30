import { computed, reactive, ref } from 'vue'
import { fetchCurrentUser, login as loginRequest } from '../api/auth'
import { getStoredAuthToken, setStoredAuthToken } from '../auth/storage'

const user = ref(null)
const loading = ref(false)
const ready = ref(false)
const dialogVisible = ref(false)
const promptMessage = ref('登录后才能继续操作')
const form = reactive({
  username: 'admin',
  password: ''
})

function resetForm() {
  form.password = ''
}

function setToken(token) {
  setStoredAuthToken(token)
}

function clearAuth() {
  setStoredAuthToken('')
  user.value = null
  resetForm()
}

async function refreshSession() {
  const token = getStoredAuthToken()
  if (!token) {
    user.value = null
    ready.value = true
    return
  }

  loading.value = true
  try {
    const data = await fetchCurrentUser()
    user.value = data.user
  } catch {
    clearAuth()
  } finally {
    loading.value = false
    ready.value = true
  }
}

async function login(credentials) {
  loading.value = true
  try {
    const data = await loginRequest(credentials)
    setToken(data.token)
    user.value = data.user
    dialogVisible.value = false
    resetForm()
    return data.user
  } finally {
    loading.value = false
  }
}

function logout() {
  clearAuth()
}

function openLoginDialog(message = '登录后才能继续操作') {
  promptMessage.value = message
  dialogVisible.value = true
}

function closeLoginDialog() {
  dialogVisible.value = false
  resetForm()
}

const isAuthenticated = computed(() => Boolean(user.value?.username))

let initialized = false

export function useAuth() {
  if (!initialized && typeof window !== 'undefined') {
    initialized = true
    window.addEventListener('pvstat-auth-required', (event) => {
      const message = event?.detail?.message || '登录后才能继续操作'
      clearAuth()
      openLoginDialog(message)
    })
  }

  return {
    user,
    loading,
    ready,
    dialogVisible,
    promptMessage,
    form,
    isAuthenticated,
    refreshSession,
    login,
    logout,
    openLoginDialog,
    closeLoginDialog
  }
}
