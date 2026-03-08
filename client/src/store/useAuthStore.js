/**
 * store/useAuthStore.js - 认证状态管理
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'

const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,
      error: null,

      /**
       * 登录
       */
      login: async (username, password) => {
        set({ isLoading: true, error: null })
        try {
          const res = await axios.post('/api/auth/login', { username, password })
          const { token, user } = res.data
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
          set({ token, user, isLoading: false })
          return { success: true }
        } catch (err) {
          const error = err.response?.data?.error || '登录失败'
          set({ error, isLoading: false })
          return { success: false, error }
        }
      },

      /**
       * 注册
       */
      register: async (username, password) => {
        set({ isLoading: true, error: null })
        try {
          const res = await axios.post('/api/auth/register', { username, password })
          const { token, user } = res.data
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
          set({ token, user, isLoading: false })
          return { success: true }
        } catch (err) {
          const error = err.response?.data?.error || '注册失败'
          set({ error, isLoading: false })
          return { success: false, error }
        }
      },

      /**
       * 登出
       */
      logout: () => {
        delete axios.defaults.headers.common['Authorization']
        set({ token: null, user: null })
      },

      /**
       * 初始化 axios 头部（页面刷新后）
       */
      initAxios: () => {
        const { token } = get()
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'jarvis-im-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)

export default useAuthStore
