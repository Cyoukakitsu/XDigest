import useStore from '../store'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function Summary() {
  const { selectedUser, tweets, summary, isLoading, setIsLoading, setFetchResult } =
    useStore()

  const fetchTweets = async () => {
    if (!selectedUser || isLoading) return
    setIsLoading(true)
    setFetchResult([], '')
    try {
      const res = await fetch(`${API}/api/fetch/${selectedUser.username}`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        setFetchResult([], `错误：${data.detail}`)
        return
      }
      setFetchResult(data.tweets, data.summary)
    } catch {
      setFetchResult([], '网络错误，请检查后端是否启动')
    } finally {
      setIsLoading(false)
    }
  }

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        请从左侧选择一个用户
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-white text-base font-semibold">@{selectedUser.username}</h2>
          {tweets.length > 0 && (
            <p className="text-gray-500 text-xs mt-0.5">今日共 {tweets.length} 条发言</p>
          )}
        </div>
        <button
          onClick={fetchTweets}
          disabled={isLoading}
          className="bg-blue-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {isLoading ? '抓取中...' : '抓取今日发言'}
        </button>
      </div>

      {summary && (
        <div className="bg-gray-800 rounded-xl p-5 text-gray-200 text-sm leading-7 whitespace-pre-wrap">
          {summary}
        </div>
      )}

      {!summary && !isLoading && (
        <div className="text-gray-600 text-sm text-center pt-10">
          点击「抓取今日发言」开始
        </div>
      )}
    </div>
  )
}
