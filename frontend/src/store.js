import { create } from 'zustand'

const useStore = create((set, get) => ({
  users: [],
  selectedUser: null,
  tweets: [],
  summary: '',
  chatHistory: [],
  isLoading: false,
  isChatLoading: false,

  setUsers: (users) => set({ users }),

  selectUser: (user) => set({
    selectedUser: user,
    tweets: [],
    summary: '',
    chatHistory: [],
  }),

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
}))

export default useStore
