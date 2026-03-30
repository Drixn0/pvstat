const AUTH_TOKEN_KEY = 'pvstat_auth_token'

export function getStoredAuthToken() {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setStoredAuthToken(token) {
  try {
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token)
      return
    }
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {
    // ignore storage failures
  }
}
