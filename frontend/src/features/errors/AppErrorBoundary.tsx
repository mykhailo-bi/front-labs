import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { ErrorPage } from '@/features/errors/ErrorPage'

type BoundaryProps = {
    children: ReactNode
    resetKey: string
}

type BoundaryState = {
    hasError: boolean
}

class ErrorBoundaryInner extends Component<BoundaryProps, BoundaryState> {
    state: BoundaryState = {
        hasError: false,
    }

    static getDerivedStateFromError(): BoundaryState {
        return { hasError: true }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('Unhandled frontend error', error, info)
    }

    componentDidUpdate(prevProps: BoundaryProps) {
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false })
        }
    }

    render() {
        if (this.state.hasError) {
            return <ErrorPage code={500} />
        }

        return this.props.children
    }
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
    const location = useLocation()

    return <ErrorBoundaryInner resetKey={location.pathname} >{children}</ErrorBoundaryInner>
}
