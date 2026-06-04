import { useEffect, useState } from 'react'
import useStore from '../store'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function Sidebar({ onLoginClick }) {
  const { users, setUsers, selectedUser, selectUser, toggleDigest, updateNote } = useStore()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [noteInput, setNoteInput] = useState('')

  const startEdit = (user, e) => {
    e.stopPropagation()
    setEditingUser(user.username)
    setNoteInput(user.note || '')
  }

  const saveNote = async (username) => {
    await updateNote(username, noteInput.trim())
    setEditingUser(null)
  }

  useEffect(() => {
    fetch(`${API}/api/users`)
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => {})
    fetch(`${API}/api/login/status`)
      .then((r) => r.json())
      .then((d) => setLoggedIn(d.logged_in))
      .catch(() => {})
  }, [])

  const refreshUsers = () =>
    fetch(`${API}/api/users`).then((r) => r.json()).then(setUsers)

  const addUser = async () => {
    const username = input.trim()
    if (!username) return
    setError('')
    const res = await fetch(`${API}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })
    if (!res.ok) {
      const err = await res.json()
      setError(err.detail || '添加失败')
      return
    }
    setInput('')
    await refreshUsers()
  }

  const deleteUser = async (username) => {
    await fetch(`${API}/api/users/${username}`, { method: 'DELETE' })
    if (selectedUser?.username === username) selectUser(null)
    await refreshUsers()
  }

  return (
    <aside className="w-60 bg-sidebar h-screen flex flex-col border-r border-sidebar-border">
      <div className="px-4 py-3.5 border-b border-sidebar-border">
        <h1 className="text-sidebar-foreground text-[11px] font-bold tracking-wider font-mono uppercase select-none">
          XDigest
        </h1>
      </div>

      <div className="p-3 border-b border-border space-y-2">
        <div className="flex gap-1.5">
          <input
            className="flex-1 bg-card border border-border text-foreground text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground font-mono"
            placeholder="添加用户名"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addUser()}
          />
          <button
            onClick={addUser}
            className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded hover:bg-primary/90 cursor-pointer transition-colors font-mono"
          >
            +
          </button>
        </div>
        {error && <p className="text-destructive text-xs font-mono">{error}</p>}
      </div>

      <ul className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
        {users.map((user) => {
          const isSelected = selectedUser?.username === user.username
          return (
            <li
              key={user.username}
              className={`px-2.5 py-2 rounded cursor-pointer group border-l-2 transition-all ${
                isSelected
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-transparent text-foreground hover:bg-muted hover:border-border'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  onClick={() => selectUser(user)}
                  className="flex-1 text-xs truncate font-mono"
                >
                  @{user.username}
                </span>
                <button
                  onClick={(e) => startEdit(user, e)}
                  className="opacity-0 group-hover:opacity-100 text-xs ml-1 cursor-pointer transition-opacity text-muted-foreground hover:text-foreground"
                  title="编辑备注"
                >
                  ✎
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleDigest(user.username, !(user.digest ?? true))
                  }}
                  className={`text-xs ml-1 transition-colors cursor-pointer ${
                    (user.digest ?? true)
                      ? 'text-secondary hover:text-secondary/70'
                      : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground'
                  }`}
                  title={(user.digest ?? true) ? '已订阅早报，点击取消' : '未订阅早报，点击开启'}
                >
                  ✉
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteUser(user.username) }}
                  className="opacity-0 group-hover:opacity-100 text-xs ml-1 cursor-pointer transition-opacity text-muted-foreground hover:text-destructive"
                >
                  ✕
                </button>
              </div>
              {user.note && editingUser !== user.username && (
                <p className="text-xs truncate mt-0.5 text-muted-foreground font-mono opacity-70">
                  {user.note}
                </p>
              )}
              {editingUser === user.username && (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    autoFocus
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveNote(user.username)
                      if (e.key === 'Escape') setEditingUser(null)
                    }}
                    onBlur={() => saveNote(user.username)}
                    className="flex-1 bg-background border border-border text-foreground text-xs rounded px-2 py-0.5 focus:outline-none min-w-0 placeholder:text-muted-foreground font-mono"
                    placeholder="添加备注..."
                  />
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => saveNote(user.username)}
                    className="text-secondary hover:text-secondary/70 text-xs flex-shrink-0 cursor-pointer"
                  >
                    ✓
                  </button>
                </div>
              )}
            </li>
          )
        })}
        {users.length === 0 && (
          <p className="text-muted-foreground text-xs text-center pt-6 font-mono opacity-50">
            暂无追踪用户
          </p>
        )}
      </ul>

      <div className="p-3 border-t border-border">
        <button
          onClick={onLoginClick}
          className="w-full text-xs py-1.5 flex items-center justify-center gap-1.5 cursor-pointer font-mono rounded hover:bg-muted transition-colors"
        >
          {loggedIn ? (
            <span className="text-secondary">● 已登录 X</span>
          ) : (
            <span className="text-muted-foreground hover:text-foreground transition-colors">○ X 账号登录</span>
          )}
        </button>
      </div>
    </aside>
  )
}
