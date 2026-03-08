/**
 * components/Chat/ContextMenu.jsx - 消息右键上下文菜单
 * 全局单例，通过 event 触发
 */

import React, { useEffect, useRef, useState } from 'react'

// 菜单项定义
function MenuItem({ item, onClose }) {
  if (item.divider) return <div className="my-1 h-px bg-discord-bg" />

  return (
    <button
      onClick={() => { item.onClick?.(); onClose() }}
      disabled={item.disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors text-left ${
        item.danger
          ? 'text-discord-red hover:bg-discord-red hover:text-white'
          : 'text-discord-text hover:bg-discord-accent hover:text-white'
      } ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {item.icon && (
        <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-base">
          {item.icon}
        </span>
      )}
      <span className="flex-1">{item.label}</span>
      {item.shortcut && (
        <span className="text-xs opacity-60 flex-shrink-0">{item.shortcut}</span>
      )}
    </button>
  )
}

export default function ContextMenu({ items, position, onClose }) {
  const menuRef = useRef(null)
  const [adjustedPos, setAdjustedPos] = useState(position)

  // 调整位置防止超出屏幕
  useEffect(() => {
    if (!menuRef.current) return
    const menu = menuRef.current
    const rect = menu.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let { x, y } = position
    if (x + rect.width > vw - 8) x = vw - rect.width - 8
    if (y + rect.height > vh - 8) y = Math.max(8, vh - rect.height - 8)
    if (x < 8) x = 8
    if (y < 8) y = 8

    setAdjustedPos({ x, y })
  }, [position])

  // 点击外部关闭
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    const keyHandler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handler, { capture: true })
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler, { capture: true })
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  return (
    <div
      ref={menuRef}
      className="fixed z-[300] min-w-[200px] bg-discord-bg border border-discord-hover rounded-lg shadow-2xl py-1.5 px-1 context-menu"
      style={{ left: adjustedPos.x, top: adjustedPos.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <MenuItem key={i} item={item} onClose={onClose} />
      ))}
    </div>
  )
}
