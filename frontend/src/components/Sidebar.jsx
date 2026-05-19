import { useEffect, useState } from 'react'
import useStore from '../store'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function Sidebar({ onLoginClick }) {
  const { users, setUsers, selectedUser, selectUser } = useStore()
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API}/api/users`)
      .then((r) => r.json())
      .then(setUsers)
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
            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer group ${
              selectedUser?.username === user.username
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span
              onClick={() => selectUser(user)}
              className="flex-1 text-sm truncate"
            >
              @{user.username}
            </span>
            <button
              onClick={() => deleteUser(user.username)}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 text-xs ml-1"
            >
              ✕
            </button>
          </li>
        ))}
        {users.length === 0 && (
          <p className="text-gray-600 text-xs text-center pt-4">暂无追踪用户</p>
        )}
      </ul>

      <div className="p-3 border-t border-gray-700">
        <button
          onClick={onLoginClick}
          className="w-full text-gray-400 text-xs hover:text-white py-1"
        >
          ⚙ X 账号登录
        </button>
      </div>
    </aside>
  )
}
