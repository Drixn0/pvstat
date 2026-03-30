import apiClient from './client'

export async function fetchHouseholds() {
  const { data } = await apiClient.get('/households')
  return data
}

export async function createHousehold(payload) {
  const { data } = await apiClient.post('/households', payload)
  return data
}

export async function updateHousehold(id, payload) {
  const { data } = await apiClient.put(`/households/${id}`, payload)
  return data
}

export async function deleteHousehold(id) {
  const { data } = await apiClient.delete(`/households/${id}`)
  return data
}

export async function deleteHouseholdsBatch(ids) {
  const { data } = await apiClient.post('/households/batch-delete', { ids })
  return data
}

export async function fetchHouseholdHistorySummary(id) {
  const { data } = await apiClient.get(`/households/${id}/history-summary`)
  return data
}

export async function fetchGenerationByMonth(month) {
  const { data } = await apiClient.get('/generation', {
    params: { month }
  })
  return data
}

export async function fetchGenerationSummary(month) {
  const { data } = await apiClient.get('/generation/summary', {
    params: { month }
  })
  return data
}

export async function upsertGeneration(payload) {
  const { data } = await apiClient.post('/generation', payload)
  return data
}
