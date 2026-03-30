import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      error.message = '请求超时，请稍后重试'
    }
    return Promise.reject(error)
  }
)

export default apiClient
