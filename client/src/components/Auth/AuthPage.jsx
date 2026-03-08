/**
 * components/Auth/AuthPage.jsx - 登录/注册页面
 */

import React, { useState } from 'react'
import useAuthStore from '../../store/useAuthStore'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const { login, register, isLoading, error, clearError } = useAuthStore()
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    clearError()
    
    if (mode === 'register') {
      if (password !== confirmPassword) {
        useAuthStore.setState({ error: '两次密码不一致' })
        return
      }
      await register(username, password)
    } else {
      await login(username, password)
    }
  }
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-discord-bg">
      <div className="w-full max-w-md bg-discord-sidebar rounded-xl shadow-2xl p-8">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🤖</div>
          <h1 className="text-2xl font-bold text-white">Jarvis IM</h1>
          <p className="text-discord-muted text-sm mt-1">即时通讯，就该这么简单</p>
        </div>
        
        {/* 标签切换 */}
        <div className="flex bg-discord-bg rounded-lg p-1 mb-6">
          <button
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'login'
                ? 'bg-discord-accent text-white'
                : 'text-discord-muted hover:text-white'
            }`}
            onClick={() => { setMode('login'); clearError() }}
          >
            登录
          </button>
          <button
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'register'
                ? 'bg-discord-accent text-white'
                : 'text-discord-muted hover:text-white'
            }`}
            onClick={() => { setMode('register'); clearError() }}
          >
            注册
          </button>
        </div>
        
        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-discord-muted uppercase mb-1">
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="输入用户名"
              className="w-full bg-discord-bg text-discord-text px-3 py-2 rounded-md border border-transparent focus:border-discord-accent outline-none text-sm"
              required
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-xs font-semibold text-discord-muted uppercase mb-1">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="输入密码"
              className="w-full bg-discord-bg text-discord-text px-3 py-2 rounded-md border border-transparent focus:border-discord-accent outline-none text-sm"
              required
            />
          </div>
          
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-discord-muted uppercase mb-1">
                确认密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                className="w-full bg-discord-bg text-discord-text px-3 py-2 rounded-md border border-transparent focus:border-discord-accent outline-none text-sm"
                required
              />
            </div>
          )}
          
          {/* 错误提示 */}
          {error && (
            <div className="bg-red-900/30 border border-discord-red text-discord-red text-sm px-3 py-2 rounded-md">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-discord-accent hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-md transition-colors"
          >
            {isLoading ? '处理中...' : mode === 'login' ? '登录' : '注册账号'}
          </button>
        </form>
        
        <p className="text-discord-muted text-xs text-center mt-4">
          {mode === 'login' ? (
            <>还没有账号？<button className="text-discord-accent hover:underline" onClick={() => { setMode('register'); clearError() }}>立即注册</button></>
          ) : (
            <>已有账号？<button className="text-discord-accent hover:underline" onClick={() => { setMode('login'); clearError() }}>返回登录</button></>
          )}
        </p>
      </div>
    </div>
  )
}
