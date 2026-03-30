import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { User } from '@/lib/api'

type EditUserInput = {
    username: string
    email: string
    password?: string
    firstname?: string
    lastname?: string
    role: 'admin' | 'customer'
    status: 'active' | 'suspended'
}

type EditUserModalProps = {
    user: User
    currentUserId: number
    isSubmitting: boolean
    onValidationError: (message: string) => void
    onUpdate: (id: number, input: EditUserInput) => Promise<void>
    onDelete: (id: number) => Promise<void>
}

export function EditUserModal({
    user,
    currentUserId,
    isSubmitting,
    onValidationError,
    onUpdate,
    onDelete,
}: EditUserModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [username, setUsername] = useState(user.username)
    const [email, setEmail] = useState(user.email)
    const [password, setPassword] = useState('')
    const [firstname, setFirstname] = useState(user.firstname ?? '')
    const [lastname, setLastname] = useState(user.lastname ?? '')
    const [isAdmin, setIsAdmin] = useState(user.role === 'admin')
    const [isActive, setIsActive] = useState(user.status === 'active')

    useEffect(() => {
        if (!isOpen) {
            return
        }

        setUsername(user.username)
        setEmail(user.email)
        setPassword('')
        setFirstname(user.firstname ?? '')
        setLastname(user.lastname ?? '')
        setIsAdmin(user.role === 'admin')
        setIsActive(user.status === 'active')
    }, [isOpen, user])

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (password.length > 0 && password.length < 8) {
            onValidationError('Password must be at least 8 characters')
            return
        }

        await onUpdate(user.id, {
            username: username.trim(),
            email: email.trim(),
            password: password.trim() || undefined,
            firstname: firstname.trim() || undefined,
            lastname: lastname.trim() || undefined,
            role: isAdmin ? 'admin' : 'customer',
            status: isActive ? 'active' : 'suspended',
        })

        setIsOpen(false)
    }

    const isCurrentUser = currentUserId === user.id

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size='sm' variant='outline'>
                    Edit
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                </DialogHeader>
                <form className='grid gap-3' onSubmit={(event) => void handleSubmit(event)}>
                    <div className='space-y-2'>
                        <Label htmlFor={`edit-user-username-${user.id}`}>Username</Label>
                        <Input
                            id={`edit-user-username-${user.id}`}
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            required
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`edit-user-email-${user.id}`}>Email</Label>
                        <Input
                            id={`edit-user-email-${user.id}`}
                            type='email'
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`edit-user-password-${user.id}`}>Password</Label>
                        <Input
                            id={`edit-user-password-${user.id}`}
                            type='password'
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            minLength={8}
                            placeholder='Leave blank to keep current password'
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`edit-user-firstname-${user.id}`}>First Name</Label>
                        <Input
                            id={`edit-user-firstname-${user.id}`}
                            value={firstname}
                            onChange={(event) => setFirstname(event.target.value)}
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor={`edit-user-lastname-${user.id}`}>Last Name</Label>
                        <Input
                            id={`edit-user-lastname-${user.id}`}
                            value={lastname}
                            onChange={(event) => setLastname(event.target.value)}
                        />
                    </div>
                    <div className='flex items-center gap-2'>
                        <Checkbox
                            id={`edit-user-admin-${user.id}`}
                            checked={isAdmin}
                            disabled={isCurrentUser}
                            onCheckedChange={(checked) => setIsAdmin(checked === true)}
                        />
                        <Label htmlFor={`edit-user-admin-${user.id}`}>Admin role</Label>
                    </div>
                    <div className='flex items-center gap-2'>
                        <Checkbox
                            id={`edit-user-active-${user.id}`}
                            checked={isActive}
                            disabled={isCurrentUser}
                            onCheckedChange={(checked) => setIsActive(checked === true)}
                        />
                        <Label htmlFor={`edit-user-active-${user.id}`}>Active</Label>
                    </div>
                    <div className='flex items-center justify-between gap-2'>
                        <Button type='submit' disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Save'}
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button type='button' variant='destructive' disabled={isSubmitting || isCurrentUser}>
                                    Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete this user.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        variant='destructive'
                                        onClick={() => {
                                            void onDelete(user.id)
                                            setIsOpen(false)
                                        }}
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
