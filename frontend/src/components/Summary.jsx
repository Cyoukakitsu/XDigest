import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
        <div className="bg-gray-800 rounded-xl p-5 text-gray-200 text-sm leading-7 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: (props) => (
                <div className="overflow-x-auto my-3">
                  <table className="w-full border-collapse text-xs" {...props} />
                </div>
              ),
              thead: (props) => <thead className="bg-gray-700" {...props} />,
              th: (props) => (
                <th className="border border-gray-600 px-3 py-2 text-left text-gray-300 font-semibold" {...props} />
              ),
              td: (props) => (
                <td className="border border-gray-600 px-3 py-2 text-gray-300 align-top" {...props} />
              ),
              tr: (props) => <tr className="even:bg-gray-750 hover:bg-gray-700/50" {...props} />,
              h1: (props) => <h1 className="text-white text-base font-bold mt-4 mb-2" {...props} />,
              h2: (props) => <h2 className="text-white text-sm font-bold mt-3 mb-1.5" {...props} />,
              h3: (props) => <h3 className="text-gray-200 text-sm font-semibold mt-2 mb-1" {...props} />,
              strong: (props) => <strong className="text-white font-semibold" {...props} />,
              ul: (props) => <ul className="list-disc list-inside space-y-1 my-2" {...props} />,
              ol: (props) => <ol className="list-decimal list-inside space-y-1 my-2" {...props} />,
              li: (props) => <li className="text-gray-300" {...props} />,
              p: (props) => <p className="my-1.5 text-gray-200" {...props} />,
              code: ({ inline, ...props }) =>
                inline ? (
                  <code className="bg-gray-700 text-blue-300 px-1 rounded text-xs" {...props} />
                ) : (
                  <code className="block bg-gray-900 text-green-300 p-3 rounded text-xs overflow-x-auto my-2" {...props} />
                ),
            }}
          >
            {summary}
          </ReactMarkdown>
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
