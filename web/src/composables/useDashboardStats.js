import { computed } from 'vue'

function summaryDisplay(hasHouseholds, hasGenerationData, value, unit, emptyText) {
  if (!hasHouseholds) {
    return { text: '等待创建', unit: emptyText }
  }

  if (!hasGenerationData && value === 0) {
    return { text: '待录入', unit: emptyText }
  }

  return { text: Number(value).toFixed(2), unit }
}

export function useDashboardStats(households, daysInMonth) {
  const totalCapacityKw = computed(() => {
    return households.value.reduce((sum, household) => {
      return sum + Number(household.capacity_kw || 0)
    }, 0)
  })

  const userStatsById = computed(() => {
    const stats = new Map()

    households.value.forEach((household) => {
      const monthTotalKwh = Object.values(household.days || {}).reduce((sum, value) => {
        return sum + (Number(value) || 0)
      }, 0)
      const price = Number(household.price_per_kwh) || 0
      const capacity = Number(household.capacity_kw) || 0

      stats.set(household.id, {
        monthTotalKwh,
        monthTotalAmount: monthTotalKwh * price,
        monthEqHours: capacity ? monthTotalKwh / capacity : 0
      })
    })

    return stats
  })

  const dailyTotals = computed(() => {
    const totals = new Map()
    daysInMonth.value.forEach((day) => {
      totals.set(day, { kwh: 0, amount: 0 })
    })

    households.value.forEach((household) => {
      const price = Number(household.price_per_kwh) || 0

      daysInMonth.value.forEach((day) => {
        const kwh = Number(household.days?.[day]) || 0
        const current = totals.get(day)
        current.kwh += kwh
        current.amount += kwh * price
      })
    })

    return totals
  })

  const grandTotals = computed(() => {
    let kwh = 0
    let amount = 0

    userStatsById.value.forEach((stat) => {
      kwh += stat.monthTotalKwh
      amount += stat.monthTotalAmount
    })

    return { kwh, amount }
  })

  const hasHouseholds = computed(() => households.value.length > 0)
  const hasGenerationData = computed(() => grandTotals.value.kwh > 0)

  const summaryMonthKwh = computed(() => {
    return summaryDisplay(
      hasHouseholds.value,
      hasGenerationData.value,
      grandTotals.value.kwh,
      'kWh',
      '先新增用户'
    )
  })

  const summaryMonthAmount = computed(() => {
    if (!hasHouseholds.value) {
      return { text: '等待创建', prefix: '', unit: '先新增用户' }
    }

    if (!hasGenerationData.value) {
      return { text: '待录入', prefix: '', unit: '录入后生成' }
    }

    return {
      text: grandTotals.value.amount.toFixed(2),
      prefix: '¥',
      unit: '当月收益'
    }
  })

  function getUserStats(userId) {
    return userStatsById.value.get(userId) || {
      monthTotalKwh: 0,
      monthTotalAmount: 0,
      monthEqHours: 0
    }
  }

  function getDailyTotals(dayStr) {
    return dailyTotals.value.get(dayStr) || { kwh: 0, amount: 0 }
  }

  return {
    totalCapacityKw,
    grandTotals,
    hasHouseholds,
    hasGenerationData,
    summaryMonthKwh,
    summaryMonthAmount,
    getUserStats,
    getDailyTotals
  }
}
