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
      <div className="bg-card border border-border rounded p-6 w-80 space-y-4" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <h2 className="text-foreground text-lg font-semibold">登录 X 账号</h2>
        <p className="text-muted-foreground text-xs">凭证仅保存在本地 cookies.json，不会上传。</p>
        <input
          className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          placeholder="用户名或邮箱 *"
          value={form.auth_info_1}
          onChange={update('auth_info_1')}
        />
        <input
          className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          placeholder="备用邮箱（可选，X 有时会要求验证）"
          value={form.auth_info_2}
          onChange={update('auth_info_2')}
        />
        <input
          type="password"
          className="w-full bg-muted border border-border text-foreground text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          placeholder="密码 *"
          value={form.password}
          onChange={update('password')}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
        {error && <p className="text-destructive text-xs">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleLogin}
            disabled={loading || !form.auth_info_1 || !form.password}
            className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg hover:bg-primary/90 disabled:opacity-40 text-sm cursor-pointer transition-colors"
          >
            {loading ? '登录中...' : '登录'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm cursor-pointer transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
