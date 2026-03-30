import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from '@/app/AppRoutes'

function App() {
    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <AppRoutes />
        </BrowserRouter>
    )
}

export default App
