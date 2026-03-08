/**
 * components/Chat/MessageList.jsx - 消息列表（虚拟滚动版）
 * 使用 @tanstack/react-virtual 实现高性能虚拟滚动
 * 支持: 时间分隔线、消息分组、滚动位置记忆、加载更多、跳转高亮
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import useChatStore from '../../store/useChatStore'
import useAuthStore from '../../store/useAuthStore'
import MessageItem from './MessageItem'
import { needsTimeDivider, isGroupedMessage, formatTimeDivider } from '../../utils/format'

// 骨架屏组件
function MessageSkeleton({ short = false }) {
  return (
    <div className="flex gap-3 px-4 py-2">
      <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3 w-32 rounded" />
        <div className={`skeleton h-3 rounded ${short ? 'w-1/3' : 'w-3/4'}`} />
        {!short && <div className="skeleton h-3 w-1/2 rounded" />}
      </div>
    </div>
  )
}

// 时间分隔线
function TimeDivider({ dateStr }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex-1 h-px bg-discord-hover" />
      <span className="text-xs text-discord-muted font-medium whitespace-nowrap">
        {formatTimeDivider(dateStr)}
      </span>
      <div className="flex-1 h-px bg-discord-hover" />
    </div>
  )
}

// 新消息分割线
function UnreadDivider() {
  return (
    <div className="flex items-center gap-3 px-4 py-1.5 select-none">
      <div className="flex-1 h-px bg-discord-red/50" />
      <span className="text-[11px] text-discord-red font-semibold whitespace-nowrap px-2 py-0.5 rounded-full border border-discord-red/40 bg-discord-red/10">
        新消息 ↑
      </span>
      <div className="flex-1 h-px bg-discord-red/50" />
    </div>
  )
}

// 空状态
function EmptyState({ channelId, dmChannelId, channels, dmList }) {
  if (channelId) {
    const channel = channels.find(c => c.id === channelId)
    return (
      <div className="px-4 py-8 text-center">
        <div className="text-6xl mb-4">👋</div>
        <h3 className="text-xl font-bold text-white mb-2">
          欢迎来到 #{channel?.name || '频道'}！
        </h3>
        <p className="text-discord-muted text-sm">
          {channel?.description || '这是该频道的开始，快来发送第一条消息吧！'}
        </p>
      </div>
    )
  }
  if (dmChannelId) {
    const dm = dmList.find(d => d.id === dmChannelId)
    return (
      <div className="px-4 py-8 text-center">
        <div className="text-6xl mb-4">💬</div>
        <h3 className="text-xl font-bold text-white mb-2">
          开始与 {dm?.otherUser?.username || '对方'} 的对话
        </h3>
        <p className="text-discord-muted text-sm">说点什么吧 ✨</p>
      </div>
    )
  }
  return null
}

// 将消息列表展平为虚拟列表的 item 数组
function buildVirtualItems(messages, firstUnreadId) {
  const items = []
  let unreadDividerInserted = false

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const prevMsg = i > 0 ? messages[i - 1] : null

    // 时间分隔线
    if (needsTimeDivider(prevMsg, msg)) {
      items.push({
        type: 'timeDivider',
        id: `divider_${msg.id}`,
        dateStr: msg.createdAt,
      })
    }

    // 未读消息分割线
    if (!unreadDividerInserted && firstUnreadId && msg.id === firstUnreadId) {
      items.push({ type: 'unreadDivider', id: 'unread_divider' })
      unreadDividerInserted = true
    }

    // 消息本体
    const grouped = isGroupedMessage(prevMsg, msg) && !needsTimeDivider(prevMsg, msg)
    items.push({
      type: 'message',
      id: msg.id || msg.tempId || i,
      message: msg,
      isGrouped: grouped,
    })
  }

  return items
}

export default function MessageList({ channelId, dmChannelId, onReply, onThread }) {
  const type = channelId ? 'channel' : 'dm'
  const id = channelId || dmChannelId
  const key = `${type}:${id}`

  const messages = useChatStore(state => state.messages[key] || [])
  const hasMore = useChatStore(state => state.hasMore[key] || false)
  const loadingMessages = useChatStore(state => state.loadingMessages)
  const typingUsers = useChatStore(state => state.typingUsers[key] || [])
  const channels = useChatStore(state => state.channels)
  const dmList = useChatStore(state => state.dmList)
  const firstUnreadId = useChatStore(state => state.firstUnreadId[key])
  const { fetchMessages } = useChatStore()
  const { user: me } = useAuthStore()

  const listRef = useRef(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [newMessageCount, setNewMessageCount] = useState(0)
  // 滚动位置记忆：key -> scrollTop
  const scrollPositions = useRef({})
  const prevKey = useRef(null)
  // 防止加载更多时抖动
  const prevTotalSizeRef = useRef(0)
  const loadingMoreRef = useRef(false)

  // 构建虚拟 items 数组
  const virtualItems = useMemo(
    () => buildVirtualItems(messages, firstUnreadId),
    [messages, firstUnreadId]
  )

  // 估算高度函数
  const estimateSize = useCallback((index) => {
    const item = virtualItems[index]
    if (!item) return 64
    if (item.type === 'timeDivider') return 40
    if (item.type === 'unreadDivider') return 36
    if (item.isGrouped) return 36
    return 72
  }, [virtualItems])

  // useVirtualizer 初始化
  const virtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => listRef.current,
    estimateSize,
    overscan: 12,
    measureElement: (el) => {
      return el?.getBoundingClientRect().height || 0
    },
  })

  // 自动滚动到底部（新消息 / 初次加载）
  useEffect(() => {
    if (autoScroll && virtualItems.length > 0) {
      // 使用 scrollToIndex 跳到最后一条
      virtualizer.scrollToIndex(virtualItems.length - 1, { align: 'end', behavior: 'auto' })
      setNewMessageCount(0)
    } else if (!autoScroll) {
      // 非底部时统计新消息数
      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.senderId !== me?.id && !lastMsg.isPending) {
        setNewMessageCount(prev => prev + 1)
      }
    }
  }, [virtualItems.length])

  // 切换频道时：保存旧位置，恢复新位置
  useEffect(() => {
    const el = listRef.current

    // 保存上一个 key 的滚动位置
    if (prevKey.current && prevKey.current !== key && el) {
      scrollPositions.current[prevKey.current] = el.scrollTop
    }

    prevKey.current = key
    setAutoScroll(true)
    setNewMessageCount(0)

    // 短暂延迟确保消息已渲染
    const timer = setTimeout(() => {
      if (!listRef.current) return
      const savedPos = scrollPositions.current[key]
      if (savedPos !== undefined && savedPos > 0) {
        listRef.current.scrollTop = savedPos
        const distFromBottom =
          listRef.current.scrollHeight - listRef.current.scrollTop - listRef.current.clientHeight
        setAutoScroll(distFromBottom < 100)
      } else {
        // 跳到底部
        if (virtualItems.length > 0) {
          virtualizer.scrollToIndex(virtualItems.length - 1, { align: 'end', behavior: 'auto' })
        }
      }
    }, 50)

    return () => clearTimeout(timer)
  }, [key])

  // 滚动监听：检测是否在底部、是否需要加载更多
  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return

    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distFromBottom < 100
    setAutoScroll(atBottom)
    if (atBottom) setNewMessageCount(0)

    // 滚动接近顶部时加载更多
    if (el.scrollTop < 150 && hasMore && !loadingMoreRef.current) {
      loadMore()
    }
  }, [hasMore])

  const loadMore = async () => {
    if (loadingMoreRef.current || !hasMore || messages.length === 0) return
    loadingMoreRef.current = true
    setLoadingMore(true)

    const oldestMsg = messages[0]
    const el = listRef.current
    const prevScrollHeight = el?.scrollHeight || 0
    const prevScrollTop = el?.scrollTop || 0

    await fetchMessages(id, type, oldestMsg.id)

    // 保持滚动位置：新增内容在顶部，所以 scrollTop 需要加上高度差
    requestAnimationFrame(() => {
      if (el) {
        const newScrollHeight = el.scrollHeight
        el.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight)
      }
      loadingMoreRef.current = false
      setLoadingMore(false)
    })
  }

  const scrollToBottom = useCallback(() => {
    if (virtualItems.length > 0) {
      virtualizer.scrollToIndex(virtualItems.length - 1, { align: 'end', behavior: 'smooth' })
    }
    setAutoScroll(true)
    setNewMessageCount(0)
  }, [virtualItems.length, virtualizer])

  // 跳转到指定消息并高亮
  const jumpToMessage = useCallback((messageId) => {
    // 先找到在 virtualItems 中的 index
    const idx = virtualItems.findIndex(
      item => item.type === 'message' && String(item.message.id) === String(messageId)
    )
    if (idx !== -1) {
      virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'smooth' })
      setTimeout(() => {
        const el = listRef.current?.querySelector(`[data-message-id="${messageId}"]`)
        if (el) {
          el.classList.remove('message-highlight')
          void el.offsetHeight
          el.classList.add('message-highlight')
          const cleanup = () => el.classList.remove('message-highlight')
          el.addEventListener('animationend', cleanup, { once: true })
        }
      }, 300)
    }
  }, [virtualItems, virtualizer])

  // 渲染单个虚拟 item
  const renderItem = useCallback((item) => {
    if (item.type === 'timeDivider') {
      return <TimeDivider dateStr={item.dateStr} />
    }
    if (item.type === 'unreadDivider') {
      return <UnreadDivider />
    }
    if (item.type === 'message') {
      return (
        <MessageItem
          message={item.message}
          onReply={onReply}
          onThread={onThread}
          isGrouped={item.isGrouped}
          onJumpToMessage={jumpToMessage}
        />
      )
    }
    return null
  }, [onReply, onThread, jumpToMessage])

  const vItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={listRef}
        className="h-full overflow-y-auto py-2"
        onScroll={handleScroll}
      >
        {/* 内容总高度容器（虚拟滚动必需） */}
        <div style={{ height: totalSize, position: 'relative' }}>
          {/* 加载更多指示器（固定在顶部） */}
          {loadingMore && (
            <div className="flex justify-center py-2 absolute top-0 left-0 right-0 z-10">
              <div className="flex items-center gap-2 text-discord-muted text-sm bg-discord-sidebar/80 backdrop-blur-sm px-3 py-1 rounded-full">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                加载中...
              </div>
            </div>
          )}

          {/* 虚拟 items */}
          {vItems.map(virtualRow => {
            const item = virtualItems[virtualRow.index]
            return (
              <div
                key={item.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {renderItem(item)}
              </div>
            )
          })}
        </div>

        {/* 初始加载骨架屏（非虚拟，直接展示） */}
        {loadingMessages && messages.length === 0 && (
          <div className="absolute inset-0 bg-discord-channel">
            <MessageSkeleton />
            <MessageSkeleton short />
            <MessageSkeleton />
            <MessageSkeleton short />
            <MessageSkeleton />
          </div>
        )}

        {/* 历史消息起始 / 空状态（显示在列表顶部之前） */}
        {!loadingMessages && !hasMore && messages.length === 0 && (
          <EmptyState
            channelId={channelId}
            dmChannelId={dmChannelId}
            channels={channels}
            dmList={dmList}
          />
        )}
      </div>

      {/* 历史起始提示（有消息 + 无更多） */}
      {!loadingMessages && !hasMore && messages.length > 0 && (
        <div
          className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none z-10"
          style={{ opacity: loadingMore ? 0 : 1, transition: 'opacity 0.2s' }}
        >
          <div className="text-discord-muted text-xs bg-discord-sidebar/70 backdrop-blur-sm px-3 py-1 rounded-full">
            — 对话的起始 ✨ —
          </div>
        </div>
      )}

      {/* 正在输入指示器 */}
      {typingUsers.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 px-4 py-1 text-xs text-discord-muted italic flex items-center gap-1 bg-discord-channel/90 backdrop-blur-sm">
          <span className="inline-flex gap-0.5">
            <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
            <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
            <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
          </span>
          <span>
            {typingUsers.length === 1
              ? `${typingUsers[0].username} 正在输入`
              : `${typingUsers.map(u => u.username).join(', ')} 正在输入`}
          </span>
        </div>
      )}

      {/* 滚动到底部按钮 */}
      {!autoScroll && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 bg-discord-accent hover:bg-indigo-600 text-white rounded-full shadow-lg transition-all flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium z-20"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          </svg>
          {newMessageCount > 0 ? `${newMessageCount} 条新消息` : '返回底部'}
        </button>
      )}
    </div>
  )
}
