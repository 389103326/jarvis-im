/**
 * store/useToastStore.js - 全局 Toast 通知系统
 * 支持: info | success | error | warning | reaction | mention
 */

import { create } from 'zustand'

let _toastId = 0

const useToastStore = create((set, get) => ({
  toasts: [],

  // 添加一条 toast
  addToast: ({ message, type = 'info', duration = 4000, avatar, emoji, action }) => {
    const id = ++_toastId
    const toast = { id, message, type, duration, avatar, emoji, action, createdAt: Date.now() }

    set(state => ({ toasts: [...state.toasts.slice(-4), toast] })) // 最多保留 5 条

    if (duration > 0) {
      setTimeout(() => {
        set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
      }, duration)
    }

    return id
  },

  // 移除
  removeToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
  },

  // 清空
  clearAll: () => set({ toasts: [] }),
}))

// 全局快捷方法（不需要 hook，任意地方可调用）
export const toast = {
  info: (message, opts) => useToastStore.getState().addToast({ message, type: 'info', ...opts }),
  success: (message, opts) => useToastStore.getState().addToast({ message, type: 'success', ...opts }),
  error: (message, opts) => useToastStore.getState().addToast({ message, type: 'error', ...opts }),
  warning: (message, opts) => useToastStore.getState().addToast({ message, type: 'warning', ...opts }),
  reaction: (message, opts) => useToastStore.getState().addToast({ message, type: 'reaction', duration: 3500, ...opts }),
  mention: (message, opts) => useToastStore.getState().addToast({ message, type: 'mention', duration: 5000, ...opts }),
}

export default useToastStore
