import { useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function LoginModal({ onClose }) {
  const [form, setForm] = useState({ auth_info_1: '', auth_info_2: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleLogin = async () => {
    if (!form.auth_info_1 || !form.password) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.detail || '登录失败')
        return
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-xl p-6 w-80 space-y-4">
        <h2 className="text-white text-lg font-semibold">登录 X 账号</h2>
        <p className="text-gray-400 text-xs">凭证仅保存在本地 cookies.json，不会上传。</p>
        <input
          className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 focus:outline-none"
          placeholder="用户名或邮箱 *"
          value={form.auth_info_1}
          onChange={update('auth_info_1')}
        />
        <input
          className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 focus:outline-none"
          placeholder="备用邮箱（可选，X 有时会要求验证）"
          value={form.auth_info_2}
          onChange={update('auth_info_2')}
        />
        <input
          type="password"
          className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 focus:outline-none"
          placeholder="密码 *"
          value={form.password}
          onChange={update('password')}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleLogin}
            disabled={loading || !form.auth_info_1 || !form.password}
            className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-40 text-sm"
          >
            {loading ? '登录中...' : '登录'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
