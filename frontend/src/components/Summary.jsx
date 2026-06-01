import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import useStore from '../store'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PERIODS = [
  { days: 1, label: '今日' },
  { days: 7, label: '本周' },
  { days: 30, label: '本月' },
]

export default function Summary() {
  const { selectedUser, tweets, summary, days, isLoading, setIsLoading, setFetchResult, setDays } =
    useStore()

  const fetchTweets = async () => {
    if (!selectedUser || isLoading) return
    setIsLoading(true)
    setFetchResult([], '')
    try {
      const res = await fetch(`${API}/api/fetch/${selectedUser.username}?days=${days}`, {
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

  const periodLabel = PERIODS.find((p) => p.days === days)?.label ?? `近${days}天`

  if (!selectedUser) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        请从左侧选择一个用户
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-foreground text-base font-semibold">@{selectedUser.username}</h2>
          {tweets.length > 0 && (
            <p className="text-muted-foreground text-xs mt-0.5">{periodLabel}共 {tweets.length} 条发言</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-border">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                disabled={isLoading}
                className={`text-xs px-3 py-1.5 transition-colors disabled:opacity-50 cursor-pointer ${
                  days === p.days
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchTweets}
            disabled={isLoading}
            className="bg-primary text-primary-foreground text-sm px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isLoading ? '抓取中...' : `抓取${periodLabel}发言`}
          </button>
        </div>
      </div>

      {summary && (
        <div className="bg-card border border-border rounded-xl p-5 text-foreground text-sm leading-7 max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: (props) => (
                <div className="overflow-x-auto my-3">
                  <table className="w-full border-collapse text-xs" {...props} />
                </div>
              ),
              thead: (props) => <thead className="bg-muted" {...props} />,
              th: (props) => (
                <th className="border border-border px-3 py-2 text-left text-foreground font-semibold" {...props} />
              ),
              td: (props) => (
                <td className="border border-border px-3 py-2 text-foreground align-top" {...props} />
              ),
              tr: (props) => <tr className="even:bg-muted/30 hover:bg-muted/50 transition-colors" {...props} />,
              h1: (props) => <h1 className="text-foreground text-base font-bold mt-4 mb-2" {...props} />,
              h2: (props) => <h2 className="text-foreground text-sm font-bold mt-3 mb-1.5" {...props} />,
              h3: (props) => <h3 className="text-foreground text-sm font-semibold mt-2 mb-1" {...props} />,
              strong: (props) => <strong className="text-foreground font-semibold" {...props} />,
              ul: (props) => <ul className="list-disc list-inside space-y-1 my-2" {...props} />,
              ol: (props) => <ol className="list-decimal list-inside space-y-1 my-2" {...props} />,
              li: (props) => <li className="text-foreground" {...props} />,
              p: (props) => <p className="my-1.5 text-foreground" {...props} />,
              code: ({ inline, ...props }) =>
                inline ? (
                  <code className="bg-muted text-primary px-1 rounded text-xs font-mono" {...props} />
                ) : (
                  <code className="block bg-muted text-foreground p-3 rounded-lg text-xs font-mono overflow-x-auto my-2" {...props} />
                ),
            }}
          >
            {summary}
          </ReactMarkdown>
        </div>
      )}

      {!summary && !isLoading && (
        <div className="text-muted-foreground text-sm text-center pt-10">
          点击「抓取{periodLabel}发言」开始
        </div>
      )}
    </div>
  )
}
