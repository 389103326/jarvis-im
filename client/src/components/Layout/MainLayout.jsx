/**
 * components/Layout/MainLayout.jsx - 主布局
 * 支持: 命令面板(Ctrl+K)、键盘快捷键(?)、右侧成员栏、移动端侧边栏抽屉
 * 快捷键: Alt+↑/↓ 在频道间导航
 */

import React, { useEffect, useState, useCallback } from 'react'
import Sidebar from '../Sidebar/Sidebar'
import ChatArea from '../Chat/ChatArea'
import MemberSidebar from '../Sidebar/MemberSidebar'
import CommandPalette from '../common/CommandPalette'
import KeyboardShortcuts from '../common/KeyboardShortcuts'
import ThreadPanel from '../Chat/ThreadPanel'
import VoiceCallModal from '../Chat/VoiceCallModal'
import useChatStore from '../../store/useChatStore'
import { getSocket } from '../../hooks/useSocket'

export default function MainLayout() {
  const {
    memberSidebarOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    activeThread,
    closeThread,
  } = useChatStore()

  const [showShortcuts, setShowShortcuts] = useState(false)
  // 移动端侧边栏抽屉状态
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), [])
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), [])

  // 切换频道/DM 时自动关闭移动端侧边栏
  const activeChannelId = useChatStore(state => state.activeChannelId)
  const activeDmId = useChatStore(state => state.activeDmId)
  useEffect(() => {
    setMobileSidebarOpen(false)
  }, [activeChannelId, activeDmId])

  // 全局键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase()
      const isInput = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable

      // Alt+↑/↓ 在频道间导航
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        const state = useChatStore.getState()
        const { channels, activeChannelId, setActiveChannel, fetchMessages } = state

        if (!channels || channels.length === 0) return

        const idx = channels.findIndex(c => c.id === activeChannelId)
        let nextIdx

        if (e.key === 'ArrowUp') {
          nextIdx = idx <= 0 ? channels.length - 1 : idx - 1
        } else {
          nextIdx = idx >= channels.length - 1 ? 0 : idx + 1
        }

        const nextChannel = channels[nextIdx]
        if (nextChannel) {
          setActiveChannel(nextChannel.id)
          getSocket()?.emit('join_channel', { channelId: nextChannel.id })
          fetchMessages(nextChannel.id, 'channel')
        }
        return
      }

      // Ctrl+K 打开命令面板
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
        return
      }

      // Esc 关闭命令面板
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false)
        return
      }

      // ? 打开快捷键帮助（非输入状态）
      if (e.key === '?' && !isInput && !commandPaletteOpen) {
        e.preventDefault()
        setShowShortcuts(true)
        return
      }

      // Esc 关闭快捷键帮助
      if (e.key === 'Escape' && showShortcuts) {
        setShowShortcuts(false)
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [commandPaletteOpen, showShortcuts, setCommandPaletteOpen])

  return (
    <div className="flex w-full h-screen overflow-hidden">
      {/* 桌面端：正常渲染侧边栏 */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* 移动端：侧边栏抽屉 */}
      {mobileSidebarOpen && (
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={closeMobileSidebar}
          />
          {/* 抽屉面板 */}
          <div className="fixed left-0 top-0 bottom-0 z-50 md:hidden animate-slideInLeft">
            <Sidebar isMobileDrawer onMobileClose={closeMobileSidebar} />
          </div>
        </>
      )}

      {/* 主聊天区域 */}
      <ChatArea onOpenMobileSidebar={openMobileSidebar} />

      {activeThread && <ThreadPanel onClose={closeThread} />}
      {memberSidebarOpen && <MemberSidebar />}
      {commandPaletteOpen && (
        <CommandPalette onClose={() => setCommandPaletteOpen(false)} />
      )}
      {showShortcuts && (
        <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />
      )}
      {/* WebRTC 通话弹窗（全局挂载） */}
      <VoiceCallModal />
    </div>
  )
}
