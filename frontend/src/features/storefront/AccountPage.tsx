import { useCallback, useEffect, useState } from 'react'
import { ApiError, changePassword, createAddress, deleteAddress, fetchAddressesForMe, fetchMe, updateAddress, updateMe, type Address, type User } from '@/lib/api'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function parseErrorMessage(error: unknown): string {
    if (error instanceof ApiError) {
        return error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    return 'Unexpected error'
}

const blankAddress = {
    label: '',
    full_name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    is_default: false,
}

export function AccountPage() {
    const [profile, setProfile] = useState<User | null>(null)
    const [addresses, setAddresses] = useState<Address[]>([])
    const [newAddress, setNewAddress] = useState(blankAddress)
    const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' })
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        setError(null)
        try {
            const [me, addressRes] = await Promise.all([fetchMe(), fetchAddressesForMe(1, 100)])
            setProfile(me)
            setAddresses(addressRes.results)
        } catch (err) {
            const message = parseErrorMessage(err)
            setError(message)
            notify.error(message)
        }
    }, [])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const applyAction = async (key: string, callback: () => Promise<void>) => {
        setBusyKey(key)
        try {
            await callback()
            await refresh()
        } catch (err) {
            notify.error(parseErrorMessage(err))
        } finally {
            setBusyKey(null)
        }
    }

    return (
        <section className='grid gap-4 lg:grid-cols-2'>
            <Card>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                    {error ? <p className='text-sm text-destructive'>{error}</p> : null}
                    <div className='space-y-2'>
                        <Label htmlFor='profile-username'>Username</Label>
                        <Input id='profile-username' value={profile?.username ?? ''} onChange={(event) => setProfile((prev) => (prev ? { ...prev, username: event.target.value } : prev))} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='profile-email'>Email</Label>
                        <Input id='profile-email' value={profile?.email ?? ''} onChange={(event) => setProfile((prev) => (prev ? { ...prev, email: event.target.value } : prev))} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='profile-firstname'>First Name</Label>
                        <Input id='profile-firstname' value={profile?.firstname ?? ''} onChange={(event) => setProfile((prev) => (prev ? { ...prev, firstname: event.target.value } : prev))} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='profile-lastname'>Last Name</Label>
                        <Input id='profile-lastname' value={profile?.lastname ?? ''} onChange={(event) => setProfile((prev) => (prev ? { ...prev, lastname: event.target.value } : prev))} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='profile-phone'>Phone</Label>
                        <Input id='profile-phone' value={profile?.phone ?? ''} onChange={(event) => setProfile((prev) => (prev ? { ...prev, phone: event.target.value } : prev))} />
                    </div>
                    <Button
                        disabled={!profile || Boolean(busyKey)}
                        onClick={() => void applyAction('profile:update', async () => {
                            if (!profile) {
                                return
                            }
                            await updateMe({
                                username: profile.username,
                                email: profile.email,
                                firstname: profile.firstname ?? '',
                                lastname: profile.lastname ?? '',
                                phone: profile.phone ?? '',
                            })
                            notify.success('Profile updated')
                        })}
                    >
                        Save profile
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Security</CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                    <div className='space-y-2'>
                        <Label htmlFor='current-password'>Current Password</Label>
                        <Input id='current-password' type='password' value={passwordForm.current_password} onChange={(event) => setPasswordForm((prev) => ({ ...prev, current_password: event.target.value }))} />
                    </div>
                    <div className='space-y-2'>
                        <Label htmlFor='new-password'>New Password</Label>
                        <Input id='new-password' type='password' value={passwordForm.new_password} onChange={(event) => setPasswordForm((prev) => ({ ...prev, new_password: event.target.value }))} />
                    </div>
                    <Button
                        disabled={Boolean(busyKey)}
                        onClick={() => void applyAction('password:update', async () => {
                            await changePassword(passwordForm)
                            setPasswordForm({ current_password: '', new_password: '' })
                            notify.success('Password changed')
                        })}
                    >
                        Update password
                    </Button>
                </CardContent>
            </Card>

            <Card className='lg:col-span-2'>
                <CardHeader>
                    <CardTitle>Addresses</CardTitle>
                </CardHeader>
                <CardContent className='space-y-3'>
                    {addresses.map((address) => (
                        <div key={address.id} className='rounded-md border p-3'>
                            <div className='grid gap-2 md:grid-cols-3'>
                                <Input value={address.full_name} onChange={(event) => setAddresses((prev) => prev.map((row) => (row.id === address.id ? { ...row, full_name: event.target.value } : row)))} />
                                <Input value={address.phone} onChange={(event) => setAddresses((prev) => prev.map((row) => (row.id === address.id ? { ...row, phone: event.target.value } : row)))} />
                                <Input value={address.line1} onChange={(event) => setAddresses((prev) => prev.map((row) => (row.id === address.id ? { ...row, line1: event.target.value } : row)))} />
                                <Input value={address.city} onChange={(event) => setAddresses((prev) => prev.map((row) => (row.id === address.id ? { ...row, city: event.target.value } : row)))} />
                                <Input value={address.postal_code} onChange={(event) => setAddresses((prev) => prev.map((row) => (row.id === address.id ? { ...row, postal_code: event.target.value } : row)))} />
                                <Input value={address.country} onChange={(event) => setAddresses((prev) => prev.map((row) => (row.id === address.id ? { ...row, country: event.target.value } : row)))} />
                            </div>
                            <div className='mt-2 flex gap-2'>
                                <Button
                                    size='sm'
                                    variant='outline'
                                    disabled={Boolean(busyKey)}
                                    onClick={() => void applyAction(`address:update:${address.id}`, async () => {
                                        await updateAddress(address.id, {
                                            full_name: address.full_name,
                                            phone: address.phone,
                                            line1: address.line1,
                                            city: address.city,
                                            postal_code: address.postal_code,
                                            country: address.country,
                                            line2: address.line2,
                                            state: address.state,
                                            label: address.label,
                                            is_default: address.is_default,
                                        })
                                        notify.success('Address updated')
                                    })}
                                >
                                    Save
                                </Button>
                                <Button
                                    size='sm'
                                    variant='destructive'
                                    disabled={Boolean(busyKey)}
                                    onClick={() => void applyAction(`address:delete:${address.id}`, async () => {
                                        await deleteAddress(address.id)
                                        notify.success('Address deleted')
                                    })}
                                >
                                    Delete
                                </Button>
                            </div>
                        </div>
                    ))}

                    <div className='rounded-md border border-dashed p-3'>
                        <p className='mb-3 text-sm font-medium'>Add new address</p>
                        <div className='grid gap-2 md:grid-cols-3'>
                            <Input placeholder='Full name' value={newAddress.full_name} onChange={(event) => setNewAddress((prev) => ({ ...prev, full_name: event.target.value }))} />
                            <Input placeholder='Phone' value={newAddress.phone} onChange={(event) => setNewAddress((prev) => ({ ...prev, phone: event.target.value }))} />
                            <Input placeholder='Line 1' value={newAddress.line1} onChange={(event) => setNewAddress((prev) => ({ ...prev, line1: event.target.value }))} />
                            <Input placeholder='City' value={newAddress.city} onChange={(event) => setNewAddress((prev) => ({ ...prev, city: event.target.value }))} />
                            <Input placeholder='Postal code' value={newAddress.postal_code} onChange={(event) => setNewAddress((prev) => ({ ...prev, postal_code: event.target.value }))} />
                            <Input placeholder='Country' value={newAddress.country} onChange={(event) => setNewAddress((prev) => ({ ...prev, country: event.target.value }))} />
                        </div>
                        <Button
                            className='mt-2'
                            size='sm'
                            disabled={Boolean(busyKey)}
                            onClick={() => void applyAction('address:create', async () => {
                                await createAddress(newAddress)
                                setNewAddress(blankAddress)
                                notify.success('Address added')
                            })}
                        >
                            Add address
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </section>
    )
}
