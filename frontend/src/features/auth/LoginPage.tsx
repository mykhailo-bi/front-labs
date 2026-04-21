/* eslint-disable jsx-a11y/tabindex-no-positive */

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

type LoginPageProps = {
    onLogin: (username: string, password: string) => Promise<void>
    isLoading: boolean
    error: string | null
}

export function LoginPage({ onLogin, isLoading, error }: LoginPageProps) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    useEffect(() => {
        if (error) {
            notify.error(error)
        }
    }, [error])

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!username.trim()) {
            notify.error('Username or email is required')
            return
        }
        if (!password) {
            notify.error('Password is required')
            return
        }
        await onLogin(username.trim(), password)
    }

    return (
        <main className='relative flex min-h-screen items-center justify-center bg-background px-4 py-10'>
            <div className='absolute right-4 top-4'>
                <ThemeModeToggle />
            </div>
            <Card className='w-full max-w-md border-border/80 shadow-sm'>
                <CardHeader className='text-center'>
                    <CardTitle className='font-heading text-2xl tracking-tight'>Welcome back</CardTitle>
                    <CardDescription>Sign in to continue to your account</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={(event) => void submit(event)}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor='username_or_email'>Username or email</FieldLabel>
                                {/* eslint-disable-next-line jsx-a11y/tabindex-no-positive */}
                                <Input
                                    tabIndex={1}
                                    id='username_or_email'
                                    autoComplete='username'
                                    placeholder='name@example.com'
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                    required
                                />
                            </Field>
                            <Field>
                                <div className='flex items-center'>
                                    <FieldLabel htmlFor='password'>Password</FieldLabel>
                                    <Link to={APP_PATHS.FORGOT_PASSWORD} className='ml-auto text-sm text-muted-foreground underline-offset-4 hover:underline'>
                                        Forgot password?
                                    </Link>
                                </div>
                                {/* eslint-disable-next-line jsx-a11y/tabindex-no-positive */}
                                <Input
                                    tabIndex={2}
                                    id='password'
                                    type='password'
                                    autoComplete='current-password'
                                    placeholder='Enter your password'
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                />
                            </Field>
                            {error ? <p className='rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>{error}</p> : null}
                            <Field>
                                <Button type='submit' className='h-11 w-full' disabled={isLoading}>
                                    {isLoading ? 'Signing in...' : 'Sign in'}
                                </Button>
                                <FieldDescription className='text-center'>
                                    Don&apos;t have an account? <Link to={APP_PATHS.REGISTER}>Create one</Link>
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
        </main>
    )
}
