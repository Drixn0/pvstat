import { ref } from 'vue'
import { createHousehold, deleteHousehold, updateHousehold } from '../api/pvstat'

function defaultNewUser() {
  return {
    name: '',
    capacity_kw: 10,
    price_per_kwh: 0.98
  }
}

export function useHouseholdManagement({ loadAll, getErrorMessage, message, messageBox }) {
  const dialogVisible = ref(false)
  const editDialogVisible = ref(false)
  const creatingUser = ref(false)
  const updatingUser = ref(false)
  const deletingUserId = ref(null)

  const newUser = ref(defaultNewUser())
  const editUser = ref({})

  function openCreateDialog() {
    dialogVisible.value = true
  }

  function closeCreateDialog() {
    dialogVisible.value = false
  }

  function closeEditDialog() {
    editDialogVisible.value = false
  }

  function openEdit(user) {
    editUser.value = {
      id: user.id,
      name: user.name,
      capacity_kw: user.capacity_kw,
      price_per_kwh: user.price_per_kwh
    }
    editDialogVisible.value = true
  }

  async function addUser() {
    if (!newUser.value.name?.trim()) {
      return message.warning('请输入户名')
    }

    creatingUser.value = true
    try {
      await createHousehold(newUser.value)
      message.success('新增成功')
      dialogVisible.value = false
      newUser.value = defaultNewUser()
      await loadAll()
    } catch (error) {
      message.error(getErrorMessage(error, '新增用户失败'))
    } finally {
      creatingUser.value = false
    }
  }

  async function saveEdit() {
    if (!editUser.value.name?.trim()) {
      return message.warning('请输入户名')
    }

    updatingUser.value = true
    try {
      await updateHousehold(editUser.value.id, editUser.value)
      message.success('修改成功')
      editDialogVisible.value = false
      await loadAll()
    } catch (error) {
      message.error(getErrorMessage(error, '修改用户失败'))
    } finally {
      updatingUser.value = false
    }
  }

  async function removeUser(user) {
    try {
      await messageBox.confirm(`确定删除用户【${user.name}】？`, '提示', { type: 'warning' })
    } catch {
      return
    }

    deletingUserId.value = user.id
    try {
      await deleteHousehold(user.id)
      message.success('删除成功')
      await loadAll()
    } catch (error) {
      message.error(getErrorMessage(error, '删除用户失败'))
    } finally {
      deletingUserId.value = null
    }
  }

  return {
    dialogVisible,
    editDialogVisible,
    creatingUser,
    updatingUser,
    deletingUserId,
    newUser,
    editUser,
    openCreateDialog,
    closeCreateDialog,
    closeEditDialog,
    openEdit,
    addUser,
    saveEdit,
    removeUser
  }
}
