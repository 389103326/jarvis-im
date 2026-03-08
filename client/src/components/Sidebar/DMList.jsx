/**
 * components/Sidebar/DMList.jsx - 私信列表
 * 支持: 未读消息角标
 */

import React from 'react'
import useChatStore from '../../store/useChatStore'
import Avatar from '../common/Avatar'
import { getSocket } from '../../hooks/useSocket'

export default function DMList() {
  const { dmList, dmUnread, activeDmId, activeType, setActiveChannel, fetchMessages, markDmRead } = useChatStore()
  
  const handleDMClick = (dm) => {
    setActiveChannel(dm.id, 'dm')
    fetchMessages(dm.id, 'dm')
    markDmRead(dm.id)
    
    // 加入 DM 房间（通过 socket）
    const socket = getSocket()
    socket?.emit('join_channel', { channelId: `dm:${dm.id}` })
  }
  
  if (dmList.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-discord-muted text-sm">暂无私信</p>
        <p className="text-discord-muted text-xs mt-1">点击用户列表中的用户发起私信</p>
      </div>
    )
  }
  
  return (
    <div>
      <div className="px-3 mb-2">
        <span className="text-xs font-semibold text-discord-muted uppercase tracking-wider">
          私信
        </span>
      </div>
      {dmList.map(dm => {
        const unread = dmUnread[dm.id] || 0
        const isActive = activeDmId === dm.id && activeType === 'dm'
        return (
          <div
            key={dm.id}
            onClick={() => handleDMClick(dm)}
            className={`channel-item flex items-center gap-2 px-3 py-2 mx-2 rounded-md cursor-pointer ${
              isActive ? 'active' : 'text-discord-muted'
            }`}
          >
            <div className="relative flex-shrink-0">
              <Avatar user={dm.otherUser} size="sm" showStatus />
              {!isActive && unread > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm truncate ${unread > 0 && !isActive ? 'text-white font-semibold' : 'text-white'}`}>
                {dm.otherUser?.username}
              </div>
              {dm.lastMessage && (
                <div className={`text-xs truncate ${unread > 0 && !isActive ? 'text-discord-text' : 'text-discord-muted'}`}>
                  {dm.lastMessage.isDeleted ? '消息已删除' :
                   dm.lastMessage.type === 'image' ? '🖼️ 图片' :
                   dm.lastMessage.content?.slice(0, 30)}
                </div>
              )}
            </div>
            {!isActive && unread > 0 && (
              <span className="unread-badge flex-shrink-0">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
