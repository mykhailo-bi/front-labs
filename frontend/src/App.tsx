import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from '@/app/AppRoutes'
import { AppErrorBoundary } from '@/features/errors/AppErrorBoundary'

function App() {
    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <AppErrorBoundary>
                <AppRoutes />
            </AppErrorBoundary>
        </BrowserRouter>
    )
}

export default App
