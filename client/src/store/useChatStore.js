/**
 * store/useChatStore.js - 聊天状态管理
 */

import { create } from 'zustand'
import axios from 'axios'

const useChatStore = create((set, get) => ({
  // 频道列表
  channels: [],
  // 频道分类列表（含 channels 数组）
  categories: [],
  // 私信列表
  dmList: [],
  // DM 未读数: dmChannelId -> count
  dmUnread: {},
  // 当前频道/DM
  activeChannelId: null,
  activeDmId: null,
  activeType: null, // 'channel' | 'dm'

  // 消息 Map: channelKey -> messages[]
  messages: {},
  // 是否还有更多历史消息
  hasMore: {},
  // 加载状态
  loadingMessages: false,

  // 在线用户 Set
  onlineUsers: new Set(),
  // 所有用户列表
  users: [],

  // 正在输入
  typingUsers: {}, // channelKey -> [{userId, username}]

  // 搜索
  searchQuery: '',
  searchResults: [],

  // UI 状态
  sidebarOpen: true,
  memberSidebarOpen: false,

  // 连接状态: 'connected' | 'disconnected' | 'reconnecting'
  connectionStatus: 'connected',

  // 固定消息: channelId -> pinnedMessages[]
  pinnedMessages: {},

  // 命令面板
  commandPaletteOpen: false,

  // 未读分割线: channelKey -> firstUnreadMessageId
  // 切换到频道时会设置，用于在 MessageList 中渲染"新消息"分割线
  firstUnreadId: {},

  // 书签/收藏: messageId Set
  bookmarks: new Set(),
  // 书签列表（完整信息）
  bookmarkList: [],
  // 书签面板开关
  bookmarkPanelOpen: false,

  // ==================== Thread/话题 ====================
  // 当前打开的线程（父消息对象）
  activeThread: null,
  // 线程消息: parentMessageId -> messages[]
  threadMessages: {},
  // 线程加载状态
  threadLoading: false,
  // DM 已读回执: dmChannelId -> { userId -> lastReadMessageId }
  dmReadReceipts: {},

  // ==================== 连接状态 ====================

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  // ==================== 频道操作 ====================

  fetchChannels: async () => {
    try {
      const res = await axios.get('/api/channels')
      set({ channels: res.data })
    } catch (err) {
      console.error('fetchChannels error:', err)
    }
  },

  fetchCategories: async () => {
    try {
      const res = await axios.get('/api/categories')
      set({ categories: res.data })
    } catch (err) {
      console.error('fetchCategories error:', err)
    }
  },

  createCategory: async (name) => {
    try {
      const res = await axios.post('/api/categories', { name })
      set(state => ({ categories: [...state.categories, res.data] }))
      return { success: true, category: res.data }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || '创建分类失败' }
    }
  },

  deleteCategory: async (id) => {
    try {
      await axios.delete(`/api/categories/${id}`)
      set(state => ({ categories: state.categories.filter(c => c.id !== id) }))
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || '删除分类失败' }
    }
  },

  // 将新频道同步更新到分类中
  addChannelToCategory: (channel) => {
    set(state => {
      const categories = state.categories.map(cat => {
        if (cat.id === channel.category_id) {
          return { ...cat, channels: [...(cat.channels || []), channel] }
        }
        return cat
      })
      return { channels: [...state.channels, channel], categories }
    })
  },

  createChannel: async (name, description, categoryId) => {
    try {
      const res = await axios.post('/api/channels', { name, description, categoryId })
      const channel = res.data
      // 更新到 categories 列表
      set(state => {
        const updatedCats = state.categories.map(cat => {
          if (cat.id === channel.category_id) {
            return { ...cat, channels: [...(cat.channels || []), channel] }
          }
          return cat
        })
        return {
          channels: [...state.channels, channel],
          categories: updatedCats,
        }
      })
      return { success: true, channel }
    } catch (err) {
      const error = err.response?.data?.error || '创建频道失败'
      return { success: false, error }
    }
  },

  updateChannelInfo: (channel) => {
    set(state => ({
      channels: state.channels.map(c => c.id === channel.id ? { ...c, ...channel } : c),
      categories: state.categories.map(cat => ({
        ...cat,
        channels: (cat.channels || []).map(c => c.id === channel.id ? { ...c, ...channel } : c),
      })),
    }))
  },

  // ==================== 用户操作 ====================

  fetchUsers: async () => {
    try {
      const res = await axios.get('/api/users')
      set({ users: res.data })
    } catch (err) {
      console.error('fetchUsers error:', err)
    }
  },

  setOnlineUsers: (userIds) => {
    set({ onlineUsers: new Set(userIds) })
  },

  updateUserStatus: (userId, status) => {
    set(state => {
      const newOnline = new Set(state.onlineUsers)
      if (status === 'online') {
        newOnline.add(userId)
      } else {
        newOnline.delete(userId)
      }
      return { onlineUsers: newOnline }
    })
  },

  // 更新用户资料（头像颜色、自定义状态、头像图片等）
  updateUserProfile: ({ id, avatarColor, customStatus, avatarUrl }) => {
    set(state => ({
      users: state.users.map(u =>
        u.id === id
          ? {
              ...u,
              ...(avatarColor !== undefined ? { avatar_color: avatarColor } : {}),
              ...(customStatus !== undefined ? { custom_status: customStatus } : {}),
              ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
            }
          : u
      )
    }))
  },

  // ==================== 私信操作 ====================

  fetchDMList: async () => {
    try {
      const res = await axios.get('/api/users/dm/list/all')
      set({ dmList: res.data })
    } catch (err) {
      console.error('fetchDMList error:', err)
    }
  },

  openDM: async (targetUserId) => {
    try {
      const res = await axios.post(`/api/users/dm/${targetUserId}`)
      const dm = res.data

      // 更新 DM 列表
      set(state => {
        const existing = state.dmList.find(d => d.id === dm.id)
        if (!existing) {
          return { dmList: [dm, ...state.dmList] }
        }
        return {}
      })

      return { success: true, dm }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || '创建私信失败' }
    }
  },

  // ==================== 消息操作 ====================

  setActiveChannel: (channelId, type = 'channel') => {
    if (type === 'channel') {
      set({ activeChannelId: channelId, activeDmId: null, activeType: 'channel' })
    } else {
      set({ activeDmId: channelId, activeChannelId: null, activeType: 'dm' })
    }
  },

  fetchMessages: async (channelId, type = 'channel', before = null) => {
    const key = `${type}:${channelId}`
    set({ loadingMessages: true })

    try {
      const url = type === 'channel'
        ? `/api/messages/channel/${channelId}`
        : `/api/messages/dm/${channelId}`

      const params = { limit: 50 }
      if (before) params.before = before

      const res = await axios.get(url, { params })
      const newMessages = res.data

      set(state => {
        const existing = state.messages[key] || []
        const allMessages = before
          ? [...newMessages, ...existing]
          : newMessages

        return {
          messages: { ...state.messages, [key]: allMessages },
          hasMore: { ...state.hasMore, [key]: newMessages.length === 50 },
          loadingMessages: false,
        }
      })
    } catch (err) {
      console.error('fetchMessages error:', err)
      set({ loadingMessages: false })
    }
  },

  // 乐观插入消息（发送前先本地显示）
  addOptimisticMessage: (tempId, message) => {
    const key = message.channelId
      ? `channel:${message.channelId}`
      : `dm:${message.dmChannelId}`

    set(state => {
      const existing = state.messages[key] || []
      return {
        messages: { ...state.messages, [key]: [...existing, { ...message, id: tempId, isPending: true }] }
      }
    })
  },

  addMessage: (message) => {
    const key = message.channelId
      ? `channel:${message.channelId}`
      : `dm:${message.dmChannelId}`

    set(state => {
      const existing = state.messages[key] || []

      // 如果有 tempId，替换乐观消息
      if (message.tempId) {
        const hasTemp = existing.find(m => m.id === message.tempId)
        if (hasTemp) {
          return {
            messages: {
              ...state.messages,
              [key]: existing.map(m => m.id === message.tempId ? { ...message, isPending: false } : m)
            }
          }
        }
      }

      // 避免重复（通过真实 id）
      if (existing.find(m => m.id === message.id)) return {}

      // isNew: true 表示这是来自 socket 的实时消息，触发进入动画
      return {
        messages: { ...state.messages, [key]: [...existing, { ...message, isPending: false, isNew: true }] },
      }
    })

    // 更新 DM 列表最后一条消息 + DM 未读计数
    if (message.dmChannelId) {
      const { activeDmId, activeType } = get()
      const isDmActive = activeType === 'dm' && activeDmId === message.dmChannelId
      const dmKey = `dm:${message.dmChannelId}`
      set(state => {
        const updates = {
          dmList: state.dmList.map(dm =>
            dm.id === message.dmChannelId
              ? { ...dm, lastMessage: message }
              : dm
          ),
          dmUnread: isDmActive
            ? state.dmUnread
            : {
                ...state.dmUnread,
                [message.dmChannelId]: (state.dmUnread[message.dmChannelId] || 0) + 1,
              },
        }
        // 设置 DM 未读分割线（首条未读）
        if (!isDmActive && !state.firstUnreadId[dmKey]) {
          updates.firstUnreadId = { ...state.firstUnreadId, [dmKey]: message.id }
        }
        return updates
      })
    }

    // 更新频道未读数
    if (message.channelId) {
      const { activeChannelId, activeType } = get()
      const isActive = activeType === 'channel' && activeChannelId === message.channelId
      const chKey = `channel:${message.channelId}`

      if (!isActive) {
        set(state => {
          const updates = {
            channels: state.channels.map(ch =>
              ch.id === message.channelId
                ? { ...ch, unreadCount: (ch.unreadCount || 0) + 1 }
                : ch
            ),
          }
          // 设置频道未读分割线（首条未读）
          if (!state.firstUnreadId[chKey]) {
            updates.firstUnreadId = { ...state.firstUnreadId, [chKey]: message.id }
          }
          return updates
        })
      }
    }
  },

  editMessage: (messageId, content, updatedAt) => {
    set(state => {
      const newMessages = {}
      for (const [key, msgs] of Object.entries(state.messages)) {
        newMessages[key] = msgs.map(m =>
          m.id === messageId
            ? { ...m, content, isEdited: true, updatedAt }
            : m
        )
      }
      return { messages: newMessages }
    })
  },

  // ACK: 消息已被服务器确认保存（更新 tempId → 真实 id）
  confirmMessage: (tempId, messageId, createdAt) => {
    set(state => {
      const newMessages = {}
      for (const [key, msgs] of Object.entries(state.messages)) {
        newMessages[key] = msgs.map(m =>
          m.id === tempId
            ? { ...m, id: messageId, isPending: false, isFailed: false, createdAt: createdAt || m.createdAt }
            : m
        )
      }
      return { messages: newMessages }
    })
  },

  // 消息发送失败（标记为失败状态，允许重试）
  failMessage: (tempId) => {
    set(state => {
      const newMessages = {}
      for (const [key, msgs] of Object.entries(state.messages)) {
        newMessages[key] = msgs.map(m =>
          m.id === tempId ? { ...m, isPending: false, isFailed: true } : m
        )
      }
      return { messages: newMessages }
    })
  },

  // 重试失败消息（重置为 pending）
  retryMessage: (tempId) => {
    set(state => {
      const newMessages = {}
      for (const [key, msgs] of Object.entries(state.messages)) {
        newMessages[key] = msgs.map(m =>
          m.id === tempId ? { ...m, isPending: true, isFailed: false } : m
        )
      }
      return { messages: newMessages }
    })
  },

  deleteMessage: (messageId) => {
    set(state => {
      const newMessages = {}
      for (const [key, msgs] of Object.entries(state.messages)) {
        newMessages[key] = msgs.map(m =>
          m.id === messageId
            ? { ...m, isDeleted: true }
            : m
        )
      }
      return { messages: newMessages }
    })
  },

  updateReactions: (messageId, reactions) => {
    set(state => {
      const newMessages = {}
      for (const [key, msgs] of Object.entries(state.messages)) {
        newMessages[key] = msgs.map(m =>
          m.id === messageId
            ? { ...m, reactions }
            : m
        )
      }
      return { messages: newMessages }
    })
  },

  // ==================== 固定消息 ====================

  setPinnedMessages: (channelId, pinnedMessages) => {
    set(state => ({
      pinnedMessages: { ...state.pinnedMessages, [channelId]: pinnedMessages }
    }))
  },

  // ==================== 未读消息 ====================

  markChannelRead: (channelId) => {
    const key = `channel:${channelId}`
    set(state => {
      const { [key]: _removed, ...restFirstUnread } = state.firstUnreadId
      return {
        channels: state.channels.map(ch =>
          ch.id === channelId ? { ...ch, unreadCount: 0 } : ch
        ),
        firstUnreadId: restFirstUnread,
      }
    })
  },

  markDmRead: (dmChannelId) => {
    const key = `dm:${dmChannelId}`
    set(state => {
      if (!state.dmUnread[dmChannelId] && !state.firstUnreadId[key]) return {}
      const newUnread = { ...state.dmUnread }
      delete newUnread[dmChannelId]
      const { [key]: _removed, ...restFirstUnread } = state.firstUnreadId
      return { dmUnread: newUnread, firstUnreadId: restFirstUnread }
    })
  },

  // ==================== 输入状态 ====================

  setTyping: (channelId, dmChannelId, userId, username, isTyping) => {
    const key = channelId ? `channel:${channelId}` : `dm:${dmChannelId}`

    set(state => {
      const current = state.typingUsers[key] || []
      let updated

      if (isTyping) {
        if (current.find(u => u.userId === userId)) {
          updated = current
        } else {
          updated = [...current, { userId, username }]
        }
      } else {
        updated = current.filter(u => u.userId !== userId)
      }

      return {
        typingUsers: { ...state.typingUsers, [key]: updated }
      }
    })
  },

  // ==================== 搜索 ====================

  searchMessages: async (query, channelId) => {
    if (!query.trim()) {
      set({ searchResults: [], searchQuery: '' })
      return
    }

    try {
      const params = { q: query }
      if (channelId) params.channelId = channelId
      const res = await axios.get('/api/messages/search', { params })
      set({ searchResults: res.data, searchQuery: query })
    } catch (err) {
      console.error('searchMessages error:', err)
    }
  },

  clearSearch: () => set({ searchResults: [], searchQuery: '' }),

  // ==================== 书签/收藏 ====================

  fetchBookmarks: async () => {
    try {
      const res = await axios.get('/api/bookmarks')
      const ids = new Set(res.data.map(b => b.message_id))
      set({ bookmarkList: res.data, bookmarks: ids })
    } catch (err) {
      console.error('fetchBookmarks error:', err)
    }
  },

  addBookmark: async (messageId) => {
    try {
      await axios.post('/api/bookmarks', { messageId })
      set(state => ({
        bookmarks: new Set([...state.bookmarks, messageId])
      }))
      // 刷新书签列表
      const res = await axios.get('/api/bookmarks')
      const ids = new Set(res.data.map(b => b.message_id))
      set({ bookmarkList: res.data, bookmarks: ids })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || '收藏失败' }
    }
  },

  removeBookmark: async (messageId) => {
    try {
      await axios.delete(`/api/bookmarks/${messageId}`)
      set(state => {
        const newSet = new Set(state.bookmarks)
        newSet.delete(messageId)
        return {
          bookmarks: newSet,
          bookmarkList: state.bookmarkList.filter(b => b.message_id !== messageId)
        }
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || '取消收藏失败' }
    }
  },

  toggleBookmarkPanel: () => set(state => ({ bookmarkPanelOpen: !state.bookmarkPanelOpen })),
  setBookmarkPanelOpen: (open) => set({ bookmarkPanelOpen: open }),

  // ==================== Thread 操作 ====================

  openThread: (message) => {
    set({ activeThread: message })
    // 加载线程消息
    useChatStore.getState().fetchThreadMessages(message.id)
  },

  closeThread: () => set({ activeThread: null }),

  fetchThreadMessages: async (parentMessageId) => {
    set({ threadLoading: true })
    try {
      const res = await axios.get(`/api/messages/${parentMessageId}/thread`)
      set(state => ({
        threadMessages: {
          ...state.threadMessages,
          [parentMessageId]: res.data.replies,
        },
        // 更新父消息的 threadStats
        messages: Object.fromEntries(
          Object.entries(state.messages).map(([key, msgs]) => [
            key,
            msgs.map(m => m.id === parentMessageId
              ? { ...m, threadStats: res.data.stats.replyCount > 0 ? res.data.stats : null }
              : m
            )
          ])
        ),
        threadLoading: false,
      }))
    } catch (err) {
      console.error('fetchThreadMessages error:', err)
      set({ threadLoading: false })
    }
  },

  addThreadMessage: (parentMessageId, message) => {
    set(state => ({
      threadMessages: {
        ...state.threadMessages,
        [parentMessageId]: [...(state.threadMessages[parentMessageId] || []), message],
      }
    }))
  },

  updateThreadStats: (parentMessageId, threadStats) => {
    set(state => ({
      messages: Object.fromEntries(
        Object.entries(state.messages).map(([key, msgs]) => [
          key,
          msgs.map(m => m.id === parentMessageId ? { ...m, threadStats } : m)
        ])
      )
    }))
  },

  // DM 已读回执
  setDmReadReceipt: (dmChannelId, userId, lastReadMessageId) => {
    set(state => ({
      dmReadReceipts: {
        ...state.dmReadReceipts,
        [dmChannelId]: {
          ...(state.dmReadReceipts[dmChannelId] || {}),
          [userId]: lastReadMessageId,
        }
      }
    }))
  },

  // ==================== UI ====================

  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
  toggleMemberSidebar: () => set(state => ({ memberSidebarOpen: !state.memberSidebarOpen })),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  // ==================== 通知偏好 ====================
  // level: 'all' | 'mentions' | 'none'
  // 存储在 localStorage，key: notif:channel:xxx 或 notif:dm:xxx

  getNotifLevel: (channelId, dmChannelId) => {
    const key = channelId ? `notif:channel:${channelId}` : `notif:dm:${dmChannelId}`;
    return localStorage.getItem(key) || 'all';
  },

  setNotifLevel: (channelId, dmChannelId, level) => {
    const key = channelId ? `notif:channel:${channelId}` : `notif:dm:${dmChannelId}`;
    if (level === 'all') {
      localStorage.removeItem(key); // 'all' 是默认值，不存储
    } else {
      localStorage.setItem(key, level);
    }
  },

  // ==================== 总未读数（用于 Tab 标题） ====================

  getTotalUnread: () => {
    const state = useChatStore.getState();
    const channelUnread = state.channels.reduce((sum, ch) => sum + (ch.unreadCount || 0), 0);
    const dmUnread = Object.values(state.dmUnread).reduce((sum, n) => sum + n, 0);
    return channelUnread + dmUnread;
  },
}))

export default useChatStore
