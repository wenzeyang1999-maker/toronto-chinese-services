// ─── Error Boundary ───────────────────────────────────────────────────────────
// Catches any React render error and shows a friendly fallback instead of
// a blank white screen. Must be a class component (React requirement).
//
// Usage:
//   <ErrorBoundary>
//     <App />
//   </ErrorBoundary>
import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  /** Optional custom fallback UI */
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ hasError: false, message: '' })

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <div className="text-5xl mb-4">😵</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">页面出错了</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-xs leading-relaxed">
          抱歉，这个页面遇到了一个意外错误。请刷新重试，或返回首页。
        </p>
        {this.state.message && (
          <p className="text-xs text-gray-400 bg-gray-100 rounded-xl px-4 py-2 mb-6 max-w-sm break-all">
            {this.state.message}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={this.reset}
            className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            重试
          </button>
          <a
            href="/"
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          >
            返回首页
          </a>
        </div>
      </div>
    )
  }
}
