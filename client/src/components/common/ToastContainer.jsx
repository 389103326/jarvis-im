/**
 * components/common/ToastContainer.jsx - 全局 Toast 通知
 * 显示在右下角，支持 info/success/error/warning/reaction/mention 类型
 */

import React, { useEffect, useState } from 'react'
import useToastStore from '../../store/useToastStore'

// 类型配置
const TYPE_CONFIG = {
  info: {
    bg: 'bg-discord-sidebar',
    border: 'border-discord-hover',
    icon: 'ℹ️',
    bar: 'bg-discord-accent',
  },
  success: {
    bg: 'bg-discord-sidebar',
    border: 'border-discord-green/50',
    icon: '✅',
    bar: 'bg-discord-green',
  },
  error: {
    bg: 'bg-discord-sidebar',
    border: 'border-discord-red/50',
    icon: '❌',
    bar: 'bg-discord-red',
  },
  warning: {
    bg: 'bg-discord-sidebar',
    border: 'border-discord-yellow/50',
    icon: '⚠️',
    bar: 'bg-discord-yellow',
  },
  reaction: {
    bg: 'bg-discord-sidebar',
    border: 'border-discord-accent/40',
    icon: null, // 用 emoji 替代
    bar: 'bg-discord-accent',
  },
  mention: {
    bg: 'bg-discord-sidebar',
    border: 'border-discord-red/40',
    icon: '🔔',
    bar: 'bg-discord-red',
  },
}

function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.info

  useEffect(() => {
    // 入场动画延迟
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const handleDismiss = () => {
    setLeaving(true)
    setTimeout(onDismiss, 300)
  }

  return (
    <div
      className={`
        relative w-80 rounded-xl border shadow-2xl overflow-hidden cursor-pointer
        transition-all duration-300 ease-out
        ${config.bg} ${config.border}
        ${visible && !leaving ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
      onClick={handleDismiss}
      title="点击关闭"
    >
      {/* 进度条 */}
      <div
        className={`absolute top-0 left-0 h-0.5 ${config.bar} transition-all`}
        style={{ animation: `toast-progress ${toast.duration}ms linear forwards` }}
      />

      <div className="flex items-start gap-3 px-4 py-3">
        {/* 图标 / emoji */}
        {toast.avatar ? (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm text-white font-bold flex-shrink-0 mt-0.5"
            style={{ backgroundColor: toast.avatar.color || '#5865f2' }}
          >
            {toast.avatar.initial}
          </div>
        ) : toast.emoji ? (
          <span className="text-xl flex-shrink-0 mt-0.5">{toast.emoji}</span>
        ) : config.icon ? (
          <span className="text-base flex-shrink-0 mt-0.5">{config.icon}</span>
        ) : null}

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-discord-text leading-snug">{toast.message}</p>
          {toast.action && (
            <button
              className="text-xs text-discord-accent hover:underline mt-1"
              onClick={(e) => { e.stopPropagation(); toast.action.fn(); handleDismiss() }}
            >
              {toast.action.label}
            </button>
          )}
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={(e) => { e.stopPropagation(); handleDismiss() }}
          className="text-discord-muted hover:text-white flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-discord-hover transition-colors mt-0.5"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem
            toast={t}
            onDismiss={() => removeToast(t.id)}
          />
        </div>
      ))}
    </div>
  )
}
