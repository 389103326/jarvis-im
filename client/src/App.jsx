/**
 * App.jsx - 应用根组件
 */

import React, { useEffect } from 'react'
import useAuthStore from './store/useAuthStore'
import useChatStore from './store/useChatStore'
import { useSocket, requestNotificationPermission } from './hooks/useSocket'
import AuthPage from './components/Auth/AuthPage'
import MainLayout from './components/Layout/MainLayout'
import ToastContainer from './components/common/ToastContainer'

// 连接状态 Banner
function ConnectionBanner() {
  const connectionStatus = useChatStore(state => state.connectionStatus)

  if (connectionStatus === 'connected') return null

  const isReconnecting = connectionStatus === 'reconnecting'

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-all ${
      isReconnecting ? 'bg-discord-yellow text-black' : 'bg-discord-red text-white'
    }`}>
      {isReconnecting ? (
        <>
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          正在重新连接...
        </>
      ) : (
        <>
          <span>⚠️</span>
          连接已断开，正在尝试重连...
        </>
      )}
    </div>
  )
}

// 文档标题未读计数
function DocumentTitle() {
  const channels = useChatStore(state => state.channels)
  const dmUnread = useChatStore(state => state.dmUnread)

  useEffect(() => {
    const channelUnread = channels.reduce((sum, ch) => sum + (ch.unreadCount || 0), 0)
    const dmUnreadTotal = Object.values(dmUnread).reduce((sum, n) => sum + n, 0)
    const total = channelUnread + dmUnreadTotal

    document.title = total > 0 ? `(${total > 99 ? '99+' : total}) Jarvis IM` : 'Jarvis IM'
  }, [channels, dmUnread])

  return null
}

export default function App() {
  const { token, user, initAxios } = useAuthStore()
  const { fetchBookmarks } = useChatStore()

  // 初始化 axios（页面刷新后恢复 token）
  useEffect(() => {
    initAxios()
    requestNotificationPermission()
  }, [])

  // 登录后加载书签
  useEffect(() => {
    if (token && user) {
      fetchBookmarks()
    }
  }, [token, user?.id])

  // 初始化 Socket 连接
  useSocket()

  if (!token || !user) {
    return <AuthPage />
  }

  return (
    <>
      <DocumentTitle />
      <ConnectionBanner />
      <ToastContainer />
      <MainLayout />
    </>
  )
}

