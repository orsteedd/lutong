import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'

interface RouteErrorBoundaryProps {
  children: ReactNode
}

interface RouteErrorBoundaryState {
  hasError: boolean
  message: string
}

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = {
    hasError: false,
    message: '',
  }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Unexpected route error',
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[RouteErrorBoundary]', error, errorInfo)
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-800">Page crashed</h2>
        <p className="mt-2 text-sm text-red-700">
          {this.state.message || 'Something went wrong while rendering this page.'}
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
        >
          Reload App
        </button>
      </div>
    )
  }
}

export default RouteErrorBoundary