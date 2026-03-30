
import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import UserManagement from '../views/UserManagement.vue'
import AuditLogs from '../views/AuditLogs.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: Dashboard },
    { path: '/users', name: 'users', component: UserManagement },
    { path: '/audit-logs', name: 'audit-logs', component: AuditLogs }
  ]
})
