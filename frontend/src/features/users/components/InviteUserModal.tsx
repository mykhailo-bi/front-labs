import { useState, type FormEvent } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type InviteUserModalProps = {
    isSubmitting: boolean
    onValidationError: (message: string) => void
    onInvite: (email: string) => Promise<void>
}

export function InviteUserModal({ isSubmitting, onValidationError, onInvite }: InviteUserModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [email, setEmail] = useState('')

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!email.trim()) {
            onValidationError('Invite email is required')
            return
        }
        await onInvite(email.trim())
        setEmail('')
        setIsOpen(false)
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant='outline' size='icon' aria-label='Invite user'>
                    <UserPlus className='size-4' />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invite User</DialogTitle>
                    <DialogDescription>Create an invitation for a new user by email</DialogDescription>
                </DialogHeader>
                <form className='grid gap-3' onSubmit={(event) => void handleSubmit(event)}>
                    <div className='space-y-2'>
                        <Label htmlFor='invite-email'>Email</Label>
                        <Input id='invite-email' type='email' value={email} onChange={(event) => setEmail(event.target.value)} required />
                    </div>
                    <div>
                        <Button type='submit' disabled={isSubmitting}>
                            {isSubmitting ? 'Inviting...' : 'Send Invite'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
