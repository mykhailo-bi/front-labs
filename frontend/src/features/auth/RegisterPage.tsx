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

type RegisterPageProps = {
    onRegister: (payload: { username: string; email: string; password: string }) => Promise<void>
    isLoading: boolean
    error: string | null
}

export function RegisterPage({ onRegister, isLoading, error }: RegisterPageProps) {
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    useEffect(() => {
        if (error) {
            notify.error(error)
        }
    }, [error])

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!username.trim()) {
            notify.error('Username is required')
            return
        }

        if (!email.trim()) {
            notify.error('Email is required')
            return
        }

        if (!password) {
            notify.error('Password is required')
            return
        }

        if (password.length < 8) {
            notify.error('Password must be at least 8 characters')
            return
        }

        await onRegister({ username: username.trim(), email: email.trim(), password })
    }

    return (
        <main className='relative flex min-h-screen items-center justify-center bg-background px-4 py-10'>
            <div className='absolute right-4 top-4'>
                <ThemeModeToggle />
            </div>
            <Card className='w-full max-w-md border-border/80 shadow-sm'>
                <CardHeader className='text-center'>
                    <CardTitle className='font-heading text-2xl tracking-tight'>Create your account</CardTitle>
                    <CardDescription>Join with your email, username, and password</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={(event) => void submit(event)}>
                        <FieldGroup>
                            <Field>
                                <FieldLabel htmlFor='register-username'>Username</FieldLabel>
                                <Input
                                    id='register-username'
                                    autoComplete='username'
                                    placeholder='jane.doe'
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                    required
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor='register-email'>Email</FieldLabel>
                                <Input
                                    id='register-email'
                                    type='email'
                                    autoComplete='email'
                                    placeholder='name@example.com'
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    required
                                />
                            </Field>
                            <Field>
                                <FieldLabel htmlFor='register-password'>Password</FieldLabel>
                                <Input
                                    id='register-password'
                                    type='password'
                                    autoComplete='new-password'
                                    placeholder='At least 8 characters'
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    required
                                />
                            </Field>
                            {error ? <p className='rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive'>{error}</p> : null}
                            <Field>
                                <Button type='submit' className='h-11 w-full' disabled={isLoading}>
                                    {isLoading ? 'Creating account...' : 'Create account'}
                                </Button>
                                <FieldDescription className='text-center'>
                                    Already have an account? <Link to={APP_PATHS.LOGIN}>Sign in</Link>
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
        </main>
    )
}
