/**
 * components/Chat/ChatArea.jsx - 聊天主区域
 */

import React, { useState, useCallback } from 'react'
import useChatStore from '../../store/useChatStore'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import SearchResults from './SearchResults'
import KeyboardShortcuts from '../common/KeyboardShortcuts'

export default function ChatArea({ onOpenMobileSidebar }) {
  const { activeChannelId, activeDmId, activeType, channels, dmList, searchMessages, clearSearch, searchQuery, openThread } = useChatStore()
  const [replyTo, setReplyTo] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const channelId = activeType === 'channel' ? activeChannelId : null
  const dmChannelId = activeType === 'dm' ? activeDmId : null
  
  // 获取频道/DM 名称
  let channelName = ''
  if (channelId) {
    const channel = channels.find(c => c.id === channelId)
    channelName = channel?.name || ''
  } else if (dmChannelId) {
    const dm = dmList.find(d => d.id === dmChannelId)
    channelName = dm?.otherUser?.username || ''
  }
  
  const handleReply = useCallback((message) => {
    setReplyTo(message)
  }, [])
  
  const handleCancelReply = useCallback(() => {
    setReplyTo(null)
  }, [])

  const handleThread = useCallback((message) => {
    openThread(message)
  }, [openThread])
  
  const handleSearch = useCallback((query) => {
    if (query) {
      searchMessages(query, null)  // null = 全局搜索（跨所有频道）
      setShowSearch(true)
    } else {
      clearSearch()
      setShowSearch(false)
    }
  }, [searchMessages, clearSearch])
  
  const handleCloseSearch = () => {
    clearSearch()
    setShowSearch(false)
  }

  const handleShowShortcuts = useCallback(() => {
    setShowShortcuts(true)
  }, [])
  
  // 没有选中频道时的空状态
  if (!channelId && !dmChannelId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-discord-channel">
        <div className="text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h2 className="text-2xl font-bold text-white mb-2">欢迎使用 Jarvis IM</h2>
          <p className="text-discord-muted">从左侧选择一个频道或发起私信开始聊天</p>
          <p className="text-discord-muted text-xs mt-2">按 <span className="bg-discord-input px-1.5 py-0.5 rounded font-mono">?</span> 查看键盘快捷键</p>
        </div>
        {showShortcuts && <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />}
      </div>
    )
  }
  
  return (
    <div className="flex-1 flex flex-col bg-discord-channel overflow-hidden relative">
      {/* 顶部标题栏 */}
      <ChatHeader
        channelId={channelId}
        dmChannelId={dmChannelId}
        onSearch={handleSearch}
        onShowShortcuts={handleShowShortcuts}
        onOpenMobileSidebar={onOpenMobileSidebar}
      />
      
      {/* 搜索结果遮罩 */}
      {showSearch && (
        <SearchResults onClose={handleCloseSearch} currentChannelId={channelId} />
      )}
      
      {/* 消息列表 */}
      <MessageList
        channelId={channelId}
        dmChannelId={dmChannelId}
        onReply={handleReply}
        onThread={handleThread}
      />
      
      {/* 输入框 */}
      <MessageInput
        channelId={channelId}
        dmChannelId={dmChannelId}
        channelName={channelName}
        replyTo={replyTo}
        onCancelReply={handleCancelReply}
      />

      {/* 键盘快捷键帮助 */}
      {showShortcuts && (
        <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  )
}

