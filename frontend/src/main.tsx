import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeModeProvider } from '@/components/theme/ThemeModeProvider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip.tsx'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeModeProvider>
            <TooltipProvider>
                <App />
                <Toaster position='bottom-right' closeButton richColors />
            </TooltipProvider>
        </ThemeModeProvider>
    </StrictMode>,
)
