/**
 * components/Chat/EmojiPicker.jsx - Emoji 选择器
 * 使用内置 emoji 列表（避免 web component 兼容问题）
 */

import React, { useState, useEffect, useRef } from 'react'

// 常用 emoji 列表
const EMOJI_CATEGORIES = [
  {
    name: '常用',
    emojis: ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '✅', '👀', '🙏', '💯'],
  },
  {
    name: '表情',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃',
      '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
      '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟',
      '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
      '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓'],
  },
  {
    name: '手势',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘',
      '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛',
      '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪'],
  },
  {
    name: '物品',
    emojis: ['🎉', '🎊', '🎈', '🎁', '🎀', '🏆', '🥇', '🎯', '🎮', '🎲', '🃏', '🎭',
      '🎨', '🎬', '🎤', '🎧', '🎵', '🎶', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️',
      '💾', '💿', '📷', '📸', '📹', '📺', '📻', '🔋', '🔌', '💡', '🔦', '🕯️'],
  },
  {
    name: '自然',
    emojis: ['🌸', '🌺', '🌻', '🌹', '🌷', '🌿', '☘️', '🍀', '🎋', '🎍', '🍁', '🍂',
      '🍃', '🌱', '🌲', '🌳', '🌴', '🌵', '🌾', '☀️', '🌤️', '⛅', '🌦️', '🌧️',
      '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '🌪️', '🌫️', '🌊', '🌈'],
  },
  {
    name: '食物',
    emojis: ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🍒', '🍌', '🍍', '🥭', '🍉', '🍈',
      '🍐', '🍏', '🥝', '🍅', '🫒', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽', '🍕',
      '🍔', '🌮', '🌯', '🥙', '🧆', '🥚', '🍳', '🥞', '🧇', '🥓', '🥩', '🍗'],
  },
]

export default function EmojiPicker({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState(0)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)
  
  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose?.()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])
  
  // 搜索过滤（简单的字符串匹配）
  const filteredEmojis = search
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => e.includes(search))
    : EMOJI_CATEGORIES[activeCategory].emojis
  
  return (
    <div
      ref={containerRef}
      className="bg-discord-sidebar border border-discord-bg rounded-xl shadow-2xl w-72 overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      {/* 搜索框 */}
      <div className="p-2 border-b border-discord-bg">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索 emoji..."
          className="w-full bg-discord-bg text-discord-text text-sm px-2 py-1.5 rounded outline-none"
          autoFocus
        />
      </div>
      
      {/* 分类标签 */}
      {!search && (
        <div className="flex overflow-x-auto border-b border-discord-bg px-1 py-1 gap-1">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(i)}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                activeCategory === i
                  ? 'bg-discord-accent text-white'
                  : 'text-discord-muted hover:text-white hover:bg-discord-hover'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}
      
      {/* Emoji 网格 */}
      <div className="p-2 max-h-48 overflow-y-auto">
        <div className="grid grid-cols-8 gap-0.5">
          {filteredEmojis.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              onClick={() => onSelect(emoji)}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-discord-hover text-xl transition-colors"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
        {filteredEmojis.length === 0 && (
          <div className="text-center text-discord-muted text-sm py-4">
            没有找到相关 emoji
          </div>
        )}
      </div>
    </div>
  )
}
