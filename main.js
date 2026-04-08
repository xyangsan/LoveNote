import App from './App'
import fui from './components/firstui/common/fui-app'
import routerGuard from '@/uni_modules/hh-router-guard/src/index'
import { hasValidLogin } from './common/auth-center.js'

// #ifndef VUE3
import Vue from 'vue'
import { PiniaVuePlugin, createPinia as createVue2Pinia } from 'pinia'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
Vue.prototype.fui = fui
Vue.use(PiniaVuePlugin)
App.mpType = 'app'
const pinia = createVue2Pinia()
const app = new Vue({
  ...App,
  pinia
})

app.use(routerGuard, {
// 白名单：无需登录即可访问的页面路径
whiteList: [
  '/pages/index/index',      // 首页
  '/pages/login/index',      // 登录页
  '/pages/profile/index',    // 个人中心
  '/pages/public/*',         // 所有公共页面
],

// 自定义登录检查函数（返回 true 表示已登录）
checkLogin: () => {
  if (hasValidLogin()) {
	return true
  }

  const token = uni.getStorageSync('uni_id_token') || uni.getStorageSync('uniIdToken')
  const tokenExpired = Number(uni.getStorageSync('uni_id_token_expired') || 0)
  return Boolean(token && (!tokenExpired || tokenExpired > Date.now()))
},

// 登录页面路径 === 需要替换为实际项目中登录页面的路径
loginPath: '/pages/login/index',

// 未登录时的处理逻辑
loginHandler: (to) => {
  uni.navigateTo({
	url: `/pages/login/index?redirect=${encodeURIComponent(to)}`
  })
}
})

app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
export function createApp() {
  const app = createSSRApp(App)
  const pinia = createPinia()
  
  app.config.globalProperties.fui = fui;
  app.use(pinia)
  
  app.use(routerGuard, {
    // 白名单：无需登录即可访问的页面路径
    whiteList: [
      '/pages/index/index',      // 首页
      '/pages/login/index',      // 登录页
      '/pages/profile/index',    // 个人中心
      '/pages/public/*',         // 所有公共页面
    ],
  
    // 自定义登录检查函数（返回 true 表示已登录）
    checkLogin: () => {
      if (hasValidLogin()) {
        return true
      }

      const token = uni.getStorageSync('uni_id_token') || uni.getStorageSync('uniIdToken')
      const tokenExpired = Number(uni.getStorageSync('uni_id_token_expired') || 0)
      return Boolean(token && (!tokenExpired || tokenExpired > Date.now()))
    },
  
    // 登录页面路径 === 需要替换为实际项目中登录页面的路径
    loginPath: '/pages/login/index',
  
    // 未登录时的处理逻辑
    loginHandler: (to) => {
      uni.navigateTo({
        url: `/pages/login/index?redirect=${encodeURIComponent(to)}`
      })
    }
  })
  
  return {
    app,
    pinia
  }
}
// #endif
