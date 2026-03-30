import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { APP_PATHS } from '@/app/paths'
import { ThemeModeToggle } from '@/components/theme/ThemeModeToggle'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notify'

type ForgotPasswordPageProps = {
    onRequestReset: (email: string) => Promise<void>
    isLoading: boolean
    error: string | null
}

export function ForgotPasswordPage({ onRequestReset, isLoading, error }: ForgotPasswordPageProps) {
    const [email, setEmail] = useState('')

    useEffect(() => {
        if (error) {
            notify.error(error)
        }
    }, [error])

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!email.trim()) {
            notify.error('Email is required')
            return
        }

        await onRequestReset(email.trim())
    }

    return (
        <main className='relative flex min-h-screen items-center justify-center bg-background px-4 py-10'>
            <div className='absolute right-4 top-4'>
                <ThemeModeToggle />
            </div>
            <Card className='w-full max-w-md border-border/80 shadow-sm'>
                <CardHeader className='text-center'>
                    <CardTitle className='font-heading text-2xl tracking-tight'>Reset your password</CardTitle>
                    <CardDescription>Enter your email and we&apos;ll send reset instructions</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={(event) => void submit(event)}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor='forgot-email'>Email</FieldLabel>
                                <Input
                                    id='forgot-email'
                                    type='email'
                                    autoComplete='email'
                                    placeholder='name@example.com'
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                />
                            </Field>
                            {error ? <p className='rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>{error}</p> : null}
                            <Field>
                                <Button type='submit' className='h-11 w-full' disabled={isLoading}>
                                    {isLoading ? 'Sending...' : 'Send reset instructions'}
                                </Button>
                                <FieldDescription className='text-center'>
                                    Remembered your password? <Link to={APP_PATHS.LOGIN}>Back to sign in</Link>
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
        </main>
    )
}
