import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type LoginPageProps = {
    onLogin: (username: string, password: string) => Promise<void>
    isLoading: boolean
    error: string | null
}

export function LoginPage({ onLogin, isLoading, error }: LoginPageProps) {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        await onLogin(username.trim(), password)
    }

    return (
        <main className='mx-auto flex min-h-screen w-full max-w-md items-center px-4'>
            <Card className='w-full'>
                <CardHeader>
                    <CardTitle>Admin Login</CardTitle>
                    <CardDescription>Sign in with your backend admin account</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className='space-y-4' onSubmit={(event) => void submit(event)}>
                        <div className='space-y-2'>
                            <Label htmlFor='username_or_email'>Username or email</Label>
                            <Input
                                id='username_or_email'
                                autoComplete='username'
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                required
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='password'>Password</Label>
                            <Input
                                id='password'
                                type='password'
                                autoComplete='current-password'
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                            />
                        </div>
                        {error ? <p className='text-sm text-destructive'>{error}</p> : null}
                        <Button type='submit' className='w-full' disabled={isLoading}>
                            {isLoading ? 'Signing in...' : 'Sign in'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    )
}
