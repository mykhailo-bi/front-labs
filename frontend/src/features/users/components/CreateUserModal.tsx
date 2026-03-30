import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type CreateUserInput = {
    username: string
    email: string
    password: string
    firstname?: string
    lastname?: string
    role: 'admin' | 'customer'
    status: 'active' | 'suspended'
}

type CreateUserModalProps = {
    isSubmitting: boolean
    onValidationError: (message: string) => void
    onCreate: (input: CreateUserInput) => Promise<void>
}

const defaultFormState = {
    username: '',
    email: '',
    password: '',
    firstname: '',
    lastname: '',
    isAdmin: false,
    isActive: true,
}

export function CreateUserModal({ isSubmitting, onValidationError, onCreate }: CreateUserModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [username, setUsername] = useState(defaultFormState.username)
    const [email, setEmail] = useState(defaultFormState.email)
    const [password, setPassword] = useState(defaultFormState.password)
    const [firstname, setFirstname] = useState(defaultFormState.firstname)
    const [lastname, setLastname] = useState(defaultFormState.lastname)
    const [isAdmin, setIsAdmin] = useState(defaultFormState.isAdmin)
    const [isActive, setIsActive] = useState(defaultFormState.isActive)

    const resetForm = () => {
        setUsername(defaultFormState.username)
        setEmail(defaultFormState.email)
        setPassword(defaultFormState.password)
        setFirstname(defaultFormState.firstname)
        setLastname(defaultFormState.lastname)
        setIsAdmin(defaultFormState.isAdmin)
        setIsActive(defaultFormState.isActive)
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (password.length < 8) {
            onValidationError('Password must be at least 8 characters')
            return
        }

        await onCreate({
            username: username.trim(),
            email: email.trim(),
            password,
            firstname: firstname.trim() || undefined,
            lastname: lastname.trim() || undefined,
            role: isAdmin ? 'admin' : 'customer',
            status: isActive ? 'active' : 'suspended',
        })

        resetForm()
        setIsOpen(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size='icon' aria-label='Create User'>
                    <Plus className='size-4' />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create User</DialogTitle>
                </DialogHeader>
                <form className='grid gap-3' onSubmit={(event) => void handleSubmit(event)}>
                    <div className='space-y-2'>
                        <Label htmlFor='user-username'>Username</Label>
                        <Input
                            id='user-username'
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            required
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='user-email'>Email</Label>
                        <Input
                            id='user-email'
                            type='email'
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='user-password'>Password</Label>
                        <Input
                            id='user-password'
                            type='password'
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            minLength={8}
                            required
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='user-firstname'>First Name</Label>
                        <Input
                            id='user-firstname'
                            value={firstname}
                            onChange={(event) => setFirstname(event.target.value)}
                        />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='user-lastname'>Last Name</Label>
                        <Input
                            id='user-lastname'
                            value={lastname}
                            onChange={(event) => setLastname(event.target.value)}
                        />
                    </div>
                    <div className='flex items-center gap-2'>
                        <Checkbox id='user-admin' checked={isAdmin} onCheckedChange={(checked) => setIsAdmin(checked === true)} />
                        <Label htmlFor='user-admin'>Admin role</Label>
                    </div>
                    <div className='flex items-center gap-2'>
                        <Checkbox
                            id='user-active'
                            checked={isActive}
                            onCheckedChange={(checked) => setIsActive(checked === true)}
                        />
                        <Label htmlFor='user-active'>Active</Label>
                    </div>
                    <div>
                        <Button type='submit' disabled={isSubmitting}>
                            {isSubmitting ? 'Creating...' : 'Create'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
