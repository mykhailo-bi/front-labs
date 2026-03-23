import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, PencilLine, UserRound } from 'lucide-react'
import { getUser } from '../services/userService'
import Loader from '../components/Loader'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '../components/ui/card'

const formatDate = (value) => {
    if (!value) {
        return '-'
    }
    return new Date(value).toLocaleString()
}

const roleVariant = (role) => {
    if (role === 'admin') {
        return 'default'
    }
    if (role === 'staff') {
        return 'secondary'
    }
    return 'outline'
}

const statusVariant = (status) => {
    if (status === 'active') {
        return 'success'
    }
    if (status === 'pending' || status === 'invited') {
        return 'warning'
    }
    return 'outline'
}

const DetailItem = ({ label, value }) => (
    <div className="rounded-lg border border-border/80 bg-muted/40 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-medium text-foreground">{value || '-'}</p>
    </div>
)

const UserViewHeader = ({ onBack }) => (
    <Card className="border-border/80 bg-card/95">
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground">
                    <UserRound className="h-3.5 w-3.5" />
                    User profile
                </div>
                <CardTitle>User details</CardTitle>
                <CardDescription>View user profile and account metadata.</CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
                Back
            </Button>
        </CardHeader>
    </Card>
)

const UserProfileCard = ({ user }) => (
    <Card className="border-border/80 bg-card/95">
        <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap gap-2">
                <Badge variant={roleVariant(user.role)}>{user.role}</Badge>
                <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                <Badge variant="outline">ID #{user.id}</Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem label="Username" value={user.username} />
                <DetailItem label="Email" value={user.email} />
                <DetailItem label="First name" value={user.firstname} />
                <DetailItem label="Last name" value={user.lastname} />
                <DetailItem label="Phone" value={user.phone} />
                <DetailItem label="Created" value={formatDate(user.created_at)} />
                <DetailItem label="Updated" value={formatDate(user.updated_at)} />
            </div>

            <div className="flex justify-end">
                <Button asChild>
                    <Link to={`/admin/users/${user.id}/edit`}>
                        <PencilLine className="h-4 w-4" />
                        Edit user
                    </Link>
                </Button>
            </div>
        </CardContent>
    </Card>
)

const UserViewPage = () => {
    const { userId } = useParams()
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const navigate = useNavigate()

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            setError('')
            try {
                const { data } = await getUser(userId)
                setUser(data)
            } catch (err) {
                setError(err?.response?.data?.detail || 'User not found')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [userId])

    return (
        <div className="space-y-4">
            <UserViewHeader onBack={() => navigate(-1)} />

            {loading && (
                <Card className="border-border/80 bg-card/95">
                    <CardContent className="p-5">
                        <Loader />
                    </CardContent>
                </Card>
            )}

            {error && (
                <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                    {error}
                </div>
            )}

            {user && !loading && !error && <UserProfileCard user={user} />}
        </div>
    )
}

export default UserViewPage
