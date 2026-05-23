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
    <aside className="w-60 bg-gray-900 h-screen flex flex-col border-r border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-white text-lg font-bold tracking-tight">XDigest</h1>
      </div>

      <div className="p-3 border-b border-gray-700 space-y-2">
        <div className="flex gap-1">
          <input
            className="flex-1 bg-gray-700 text-white text-sm rounded px-2 py-1 focus:outline-none"
            placeholder="添加用户名"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addUser()}
          />
          <button
            onClick={addUser}
            className="bg-blue-500 text-white text-sm px-2 py-1 rounded hover:bg-blue-600"
          >
            +
          </button>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>

      <ul className="flex-1 overflow-y-auto p-2 space-y-1">
        {users.map((user) => (
          <li
            key={user.username}
            className={`px-3 py-2 rounded-lg cursor-pointer group ${
              selectedUser?.username === user.username
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                onClick={() => selectUser(user)}
                className="flex-1 text-sm truncate"
              >
                @{user.username}
              </span>
              <button
                onClick={(e) => startEdit(user, e)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-200 text-xs ml-1"
                title="编辑备注"
              >
                ✎
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleDigest(user.username, !(user.digest ?? true))
                }}
                className={`text-xs ml-1 transition-colors ${
                  (user.digest ?? true)
                    ? 'text-blue-400 hover:text-blue-200'
                    : 'opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-300'
                }`}
                title={(user.digest ?? true) ? '已订阅早报，点击取消' : '未订阅早报，点击开启'}
              >
                ✉
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteUser(user.username) }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 text-xs ml-1"
              >
                ✕
              </button>
            </div>
            {user.note && editingUser !== user.username && (
              <p className={`text-xs truncate mt-0.5 ${
                selectedUser?.username === user.username ? 'text-blue-200' : 'text-gray-500'
              }`}>
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
                  className="flex-1 bg-gray-600 text-white text-xs rounded px-2 py-0.5 focus:outline-none min-w-0"
                  placeholder="添加备注..."
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => saveNote(user.username)}
                  className="text-green-400 hover:text-green-200 text-xs flex-shrink-0"
                >
                  ✓
                </button>
              </div>
            )}
          </li>
        ))}
        {users.length === 0 && (
          <p className="text-gray-600 text-xs text-center pt-4">暂无追踪用户</p>
        )}
      </ul>

      <div className="p-3 border-t border-gray-700">
        <button
          onClick={onLoginClick}
          className="w-full text-xs py-1 flex items-center justify-center gap-1"
        >
          {loggedIn ? (
            <span className="text-green-400 hover:text-green-300">✓ 已登录 X</span>
          ) : (
            <span className="text-gray-400 hover:text-white">⚙ X 账号登录</span>
          )}
        </button>
      </div>
    </aside>
  )
}
