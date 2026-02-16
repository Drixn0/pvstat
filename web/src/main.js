import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import router from './router'

// ✅ 引入中文语言包
import zhCn from 'element-plus/es/locale/lang/zh-cn'

// ✅ dayjs 设置中文（月份面板必须）
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
dayjs.locale('zh-cn')

createApp(App)
  .use(ElementPlus, { locale: zhCn })
  .use(router)
  .mount('#app')