import { useNavigate } from 'react-router-dom'
import type { ComponentType } from 'react'
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/components/ui/empty'
import { ThemeModeToggle } from '@/components/theme/ThemeModeToggle'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ArrowLeft, CircleAlert, LogOut, OctagonX, Server, ShieldX, TimerReset } from 'lucide-react'

type ErrorCode = 400 | 403 | 404 | 409 | 429 | 500 | 503

type ErrorPageProps = {
    code: ErrorCode
    onLogout?: () => void | Promise<void>
}

const errorConfig: Record<ErrorCode, { title: string; description: string; icon: ComponentType<{ className?: string }> }> = {
    400: {
        title: 'Bad request',
        description: 'The request could not be processed. Check the input and try again.',
        icon: CircleAlert,
    },
    403: {
        title: 'Access denied',
        description: 'You do not have permission to view this resource.',
        icon: ShieldX,
    },
    404: {
        title: 'Page not found',
        description: 'The page you requested does not exist or was moved.',
        icon: AlertTriangle,
    },
    409: {
        title: 'Conflict detected',
        description: 'This action conflicts with the current resource state.',
        icon: CircleAlert,
    },
    429: {
        title: 'Too many requests',
        description: 'You are making requests too quickly. Wait a moment and try again.',
        icon: TimerReset,
    },
    500: {
        title: 'Server error',
        description: 'Something went wrong on our end. Please try again shortly.',
        icon: OctagonX,
    },
    503: {
        title: 'Service unavailable',
        description: 'The service is temporarily unavailable. Please try again later.',
        icon: Server,
    },
}

export function ErrorPage({ code, onLogout }: ErrorPageProps) {
    const navigate = useNavigate()
    const config = errorConfig[code]
    const Icon = config.icon

    return (
        <main className='relative flex min-h-screen items-center justify-center px-4 py-10'>
            <div className='absolute right-4 top-4'>
                <ThemeModeToggle />
            </div>
            <Empty className='max-w-lg rounded-2xl border border-border/70 bg-card/40'>
                <EmptyHeader>
                    <EmptyMedia variant='icon' className='size-12 rounded-xl'>
                        <Icon className='size-6' />
                    </EmptyMedia>
                    <Badge variant='secondary'>Error {code}</Badge>
                    <EmptyTitle className='text-lg'>{config.title}</EmptyTitle>
                    <EmptyDescription>{config.description}</EmptyDescription>
                </EmptyHeader>
                <div className='mt-2 flex gap-2'>
                    <Button type='button' onClick={() => navigate(-1)}>
                        <ArrowLeft className='size-4' />
                        Go back
                    </Button>
                    {code === 403 && onLogout ? (
                        <Button type='button' variant='outline' onClick={() => void onLogout()}>
                            <LogOut className='size-4' />
                            Log out
                        </Button>
                    ) : null}
                </div>
            </Empty>
        </main>
    )
}
