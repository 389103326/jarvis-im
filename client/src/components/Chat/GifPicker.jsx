/**
 * components/Chat/GifPicker.jsx - GIF 选择器
 * 使用 Tenor API v1 提供 trending/搜索功能
 * 默认使用 Tenor 开发者测试 Key，生产环境建议替换
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'

const TENOR_KEY = 'LIVDSRZULELA' // Tenor 公开测试 key
const LIMIT = 20

export default function GifPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const searchTimer = useRef(null)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const fetchGifs = useCallback(async (q) => {
    setLoading(true)
    setError(null)
    try {
      const endpoint = q.trim()
        ? `https://api.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=${LIMIT}&media_filter=minimal&locale=zh_CN&contentfilter=medium`
        : `https://api.tenor.com/v1/trending?key=${TENOR_KEY}&limit=${LIMIT}&media_filter=minimal&locale=zh_CN&contentfilter=medium`
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setGifs(data.results || [])
    } catch (e) {
      console.error('GIF fetch error:', e)
      setError('加载失败，请检查网络')
    }
    setLoading(false)
  }, [])

  // 初始加载 trending GIFs
  useEffect(() => {
    fetchGifs('')
    // 自动聚焦搜索框
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const handleSearch = (e) => {
    const val = e.target.value
    setQuery(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchGifs(val), 400)
  }

  // 点击外部关闭
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // 处理 GIF 选择：提取最佳质量 URL
  const handleSelect = (gif) => {
    const media = gif.media?.[0] || {}
    // 优先 gif，降级 tinygif
    const gifMedia = media.gif || media.tinygif
    const previewMedia = media.tinygif || media.gif
    if (!gifMedia) return

    onSelect({
      url: gifMedia.url,
      previewUrl: previewMedia?.url || gifMedia.url,
      width: gifMedia.dims?.[0] || 400,
      height: gifMedia.dims?.[1] || 300,
      title: gif.title || 'GIF',
      id: gif.id,
    })
  }

  // 将 GIFs 分成两列（瀑布流）
  const col1 = gifs.filter((_, i) => i % 2 === 0)
  const col2 = gifs.filter((_, i) => i % 2 === 1)

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full right-0 mb-2 w-80 bg-discord-sidebar border border-discord-bg rounded-xl shadow-2xl z-30 overflow-hidden flex flex-col"
      style={{ maxHeight: '400px' }}
    >
      {/* 头部 */}
      <div className="p-3 border-b border-discord-bg flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-white flex items-center gap-1.5">
            <span className="text-base">🎬</span> GIF
          </span>
          <button
            onClick={onClose}
            className="text-discord-muted hover:text-white text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-discord-hover transition-colors"
          >
            ✕
          </button>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleSearch}
          placeholder="搜索 GIF..."
          className="w-full bg-discord-bg border border-discord-hover rounded-lg px-3 py-1.5 text-sm text-discord-text focus:outline-none focus:border-discord-accent transition-colors"
        />
      </div>

      {/* GIF 网格 */}
      <div className="overflow-y-auto flex-1 min-h-0" style={{ maxHeight: '310px' }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <div className="w-6 h-6 border-2 border-discord-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-discord-muted text-xs">加载中...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <span className="text-discord-muted text-sm">{error}</span>
            <button
              onClick={() => fetchGifs(query)}
              className="text-xs text-discord-accent hover:underline"
            >
              重试
            </button>
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-discord-muted text-sm">
            没有找到相关 GIF
          </div>
        ) : (
          <div className="flex gap-1 p-2">
            {/* 双列瀑布流 */}
            {[col1, col2].map((col, ci) => (
              <div key={ci} className="flex-1 flex flex-col gap-1">
                {col.map((gif) => {
                  const media = gif.media?.[0] || {}
                  const preview = media.tinygif || media.gif
                  if (!preview) return null
                  const [w, h] = preview.dims || [200, 150]
                  const aspectPct = ((h / w) * 100).toFixed(1)
                  return (
                    <button
                      key={gif.id}
                      onClick={() => handleSelect(gif)}
                      className="relative w-full rounded-lg overflow-hidden hover:opacity-90 active:opacity-70 transition-opacity focus:outline-none focus:ring-2 focus:ring-discord-accent group"
                      title={gif.title}
                    >
                      <div style={{ paddingBottom: `${aspectPct}%`, position: 'relative' }}>
                        <img
                          src={preview.url}
                          alt={gif.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                        {/* Hover 遮罩 */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部版权 */}
      <div className="px-3 py-1.5 text-xs text-discord-muted border-t border-discord-bg text-center flex-shrink-0 flex items-center justify-center gap-1">
        <span>Powered by</span>
        <span className="font-semibold text-discord-muted/80">Tenor</span>
      </div>
    </div>
  )
}
