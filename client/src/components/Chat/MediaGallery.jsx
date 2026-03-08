/**
 * components/Chat/MediaGallery.jsx - 频道媒体画廊
 * 显示频道内所有图片消息，支持瀑布流布局和灯箱预览
 */

import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { formatMessageTime } from '../../utils/format'

// 图片灯箱
function Lightbox({ images, initialIndex, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const current = images[currentIndex]

  const handlePrev = useCallback(() => {
    setCurrentIndex(i => (i > 0 ? i - 1 : images.length - 1))
  }, [images.length])

  const handleNext = useCallback(() => {
    setCurrentIndex(i => (i < images.length - 1 ? i + 1 : 0))
  }, [images.length])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, handlePrev, handleNext])

  return (
    <div
      className="fixed inset-0 bg-black/95 z-[400] flex items-center justify-center"
      onClick={onClose}
    >
      {/* 顶部信息栏 */}
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/60 to-transparent"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <div className="text-white font-medium text-sm">{current.username}</div>
          <div className="text-discord-muted text-xs">{formatMessageTime(current.createdAt)}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-discord-muted text-sm">{currentIndex + 1} / {images.length}</span>
          <a
            href={current.content}
            download
            className="text-discord-muted hover:text-white transition-colors"
            title="下载图片"
            onClick={e => e.stopPropagation()}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
          </a>
          <button
            onClick={onClose}
            className="text-discord-muted hover:text-white transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 图片 */}
      <img
        src={current.content}
        alt="媒体预览"
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      />

      {/* 上一张 */}
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); handlePrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>
      )}

      {/* 下一张 */}
      {images.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); handleNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </button>
      )}

      {/* 底部缩略图条 */}
      {images.length > 1 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/60 rounded-xl max-w-[90vw] overflow-x-auto"
          onClick={e => e.stopPropagation()}
        >
          {images.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => setCurrentIndex(idx)}
              className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden transition-all ${
                idx === currentIndex ? 'ring-2 ring-discord-accent scale-105' : 'opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img.content} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MediaGallery({ channelId, dmChannelId, onClose }) {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    const fetchMedia = async () => {
      setLoading(true)
      try {
        const url = channelId
          ? `/api/messages/channel/${channelId}`
          : `/api/messages/dm/${dmChannelId}`
        // 拉取最多 200 条消息，筛选图片
        const res = await axios.get(url, { params: { limit: 200, type: 'image' } })
        const imgs = res.data.filter(m => (m.type === 'image' || m.type === 'gif') && !m.isDeleted)
        setImages(imgs.reverse()) // 从旧到新
      } catch (err) {
        console.error('MediaGallery fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchMedia()
  }, [channelId, dmChannelId])

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 z-[150] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-discord-sidebar rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-discord-bg flex-shrink-0">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span>🖼️</span>
              <span>媒体画廊</span>
              {!loading && (
                <span className="text-discord-muted text-sm font-normal">· {images.length} 张图片</span>
              )}
            </h3>
            <button
              onClick={onClose}
              className="text-discord-muted hover:text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-discord-hover transition-colors"
            >
              ✕
            </button>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="skeleton aspect-square rounded-lg" />
                ))}
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">🖼️</div>
                <p className="text-discord-muted text-sm">该频道还没有分享过图片</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setLightboxIndex(idx)}
                    className="relative aspect-square rounded-lg overflow-hidden group/img bg-discord-bg hover:ring-2 hover:ring-discord-accent transition-all"
                    title={`${img.username} · ${formatMessageTime(img.createdAt)}`}
                  >
                    <img
                      src={img.content}
                      alt={`${img.username}的图片`}
                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                    {/* hover 遮罩 */}
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors flex items-end">
                      <div className="w-full px-2 pb-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity">
                        <p className="text-white text-xs font-medium truncate">{img.username}</p>
                        <p className="text-white/70 text-[10px]">{formatMessageTime(img.createdAt)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 灯箱 */}
      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  )
}
