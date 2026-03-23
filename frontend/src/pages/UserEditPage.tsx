import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, UserCog } from 'lucide-react'
import { createUser, getUser, updateUser } from '../services/userService'
import Loader from '../components/Loader'
import { Button } from '../components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

const initialState = {
    username: '',
    email: '',
    firstname: '',
    lastname: '',
    phone: '',
    role: 'customer',
    status: 'active',
    password: '',
}

const SELECT_CLASS_NAME = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

type UserEditMode = 'create' | 'edit'

const useUserForm = (mode: UserEditMode, userId?: string) => {
    const isCreate = mode === 'create'
    const [form, setForm] = useState(initialState)
    const [loading, setLoading] = useState(!isCreate)
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (isCreate) {
            return
        }
        const load = async () => {
            setLoading(true)
            setError('')
            try {
                const { data } = await getUser(userId)
                setForm({
                    username: data.username || '',
                    email: data.email || '',
                    firstname: data.firstname || '',
                    lastname: data.lastname || '',
                    phone: data.phone || '',
                    role: data.role || 'customer',
                    status: data.status || 'active',
                    password: '',
                })
            } catch (err) {
                setError(err?.response?.data?.detail || 'User not found')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [isCreate, userId])

    const handleChange = (event) => {
        const { name, value } = event.target
        setForm((prev) => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        setSubmitting(true)
        setError('')
        try {
            if (isCreate) {
                await createUser({ ...form, password: form.password || undefined })
            } else {
                const payload = { ...form }
                if (!payload.password) {
                    delete payload.password
                }
                await updateUser(userId, payload)
            }
            return true
        } catch (err) {
            setError(err?.response?.data?.detail || 'Save failed')
            return false
        } finally {
            setSubmitting(false)
        }
    }

    return { form, loading, error, submitting, handleChange, handleSubmit }
}

const USER_FIELDS = [
    { id: 'username', label: 'Username', required: true },
    { id: 'email', label: 'Email', type: 'email', required: true },
    { id: 'firstname', label: 'First name' },
    { id: 'lastname', label: 'Last name' },
    { id: 'phone', label: 'Phone' },
]

const UserEditHeader = ({ isCreate, onCancel }) => (
    <Card className="border-border/80 bg-card/95">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
                    <UserCog className="h-3.5 w-3.5" />
                    Admin only
                </div>
                <CardTitle>{isCreate ? 'Create user' : 'Edit user'}</CardTitle>
                <CardDescription>Manage profile details, role, status, and credentials.</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={onCancel}>
                <ArrowLeft className="h-4 w-4" />
                Cancel
            </Button>
        </CardHeader>
    </Card>
)

const UserInputFields = ({ form, isCreate, onChange }) => (
    <>
        {USER_FIELDS.map((field) => (
            <div className="space-y-2" key={field.id}>
                <Label htmlFor={field.id}>{field.label}</Label>
                <Input
                    id={field.id}
                    name={field.id}
                    type={field.type || 'text'}
                    value={form[field.id]}
                    onChange={onChange}
                    required={field.required}
                />
            </div>
        ))}

        <div className="space-y-2">
            <Label htmlFor="password">Password {isCreate ? '' : '(optional)'}</Label>
            <Input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={onChange}
                required={isCreate}
            />
        </div>
    </>
)

const UserSelectFields = ({ form, onChange }) => (
    <>
        <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
                id="role"
                name="role"
                value={form.role}
                className={SELECT_CLASS_NAME}
                onChange={onChange}
            >
                <option value="admin">Admin</option>
                <option value="customer">Customer</option>
            </select>
        </div>

        <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
                id="status"
                name="status"
                value={form.status}
                className={SELECT_CLASS_NAME}
                onChange={onChange}
            >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
            </select>
        </div>
    </>
)

const UserFormCard = ({
    error,
    form,
    isCreate,
    onSubmit,
    onCancel,
    onChange,
    submitting,
}) => (
    <Card className="border-border/80 bg-card/95">
        <CardContent className="space-y-4 pt-5">
            {error && (
                <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                    {error}
                </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <UserInputFields form={form} isCreate={isCreate} onChange={onChange} />
                    <UserSelectFields form={form} onChange={onChange} />
                </div>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                        <Save className="h-4 w-4" />
                        {submitting ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </form>
        </CardContent>
    </Card>
)

const UserEditPage = ({ mode }: { mode: UserEditMode }) => {
    const isCreate = mode === 'create'
    const { userId } = useParams()
    const navigate = useNavigate()
    const {
        form,
        loading,
        error,
        submitting,
        handleChange,
        handleSubmit,
    } = useUserForm(mode, userId)

    const onSubmit = async (event) => {
        const ok = await handleSubmit(event)
        if (ok) {
            navigate('/admin/users', { replace: true })
        }
    }

    const handleCancel = () => {
        navigate(-1)
    }

    return (
        <div className="space-y-4">
            <UserEditHeader isCreate={isCreate} onCancel={handleCancel} />

            {loading && (
                <Card className="border-border/80 bg-card/95">
                    <CardContent className="p-5">
                        <Loader />
                    </CardContent>
                </Card>
            )}

            {!loading && (
                <UserFormCard
                    error={error}
                    form={form}
                    isCreate={isCreate}
                    onSubmit={onSubmit}
                    onCancel={handleCancel}
                    onChange={handleChange}
                    submitting={submitting}
                />
            )}
        </div>
    )
}

export default UserEditPage
