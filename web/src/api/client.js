import axios from 'axios'
import { getStoredAuthToken, setStoredAuthToken } from '../auth/storage'

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000
})

apiClient.interceptors.request.use((config) => {
  const token = getStoredAuthToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.message = '请求超时，请稍后重试'
    }
    if (error?.response?.status === 401) {
      setStoredAuthToken('')
      const requestUrl = String(error?.config?.url || '')
      if (!requestUrl.includes('/auth/login') && !requestUrl.includes('/auth/me') && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pvstat-auth-required', {
          detail: {
            message: error?.response?.data?.error || '登录后才能修改数据'
          }
        }))
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
