import { create } from 'zustand'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const useStore = create((set, get) => ({
  users: [],
  selectedUser: null,
  tweets: [],
  summary: '',
  chatHistory: [],
  days: 1,
  isLoading: false,
  isChatLoading: false,

  setUsers: (users) => set({ users }),

  selectUser: (user) => set({
    selectedUser: user,
    tweets: [],
    summary: '',
    chatHistory: [],
    days: 1,
  }),

  setDays: (days) => set({ days }),

  setFetchResult: (tweets, summary) => set({ tweets, summary }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setIsChatLoading: (isChatLoading) => set({ isChatLoading }),

  addUserMessage: (content) =>
    set((state) => ({
      chatHistory: [
        ...state.chatHistory,
        { role: 'user', content },
        { role: 'assistant', content: '' },
      ],
    })),

  appendAssistantChunk: (chunk) =>
    set((state) => {
      const history = [...state.chatHistory]
      const last = history[history.length - 1]
      if (last && last.role === 'assistant') {
        history[history.length - 1] = { ...last, content: last.content + chunk }
      }
      return { chatHistory: history }
    }),

  updateNote: async (username, note) => {
    try {
      await fetch(`${API}/api/users/${username}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })
      set((state) => ({
        users: state.users.map((u) =>
          u.username === username ? { ...u, note } : u
        ),
      }))
    } catch (e) {
      console.error('updateNote failed:', e)
    }
  },

  toggleDigest: async (username, digest) => {
    try {
      await fetch(`${API}/api/users/${username}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest }),
      })
      set((state) => ({
        users: state.users.map((u) =>
          u.username === username ? { ...u, digest } : u
        ),
      }))
    } catch (e) {
      console.error('toggleDigest failed:', e)
    }
  },
}))

export default useStore
