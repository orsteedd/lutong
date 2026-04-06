import { Link } from 'react-router-dom'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components'
import { useAuthStore } from '@/store'

const ForbiddenPage = () => {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#e7f4ef_0%,#edf4f1_40%,#d7e7df_100%)] px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <Card className="border-red-200 bg-white/95 shadow-[0_24px_64px_rgba(15,23,42,0.12)]">
          <CardHeader className="border-b border-red-100 bg-red-50/70">
            <CardTitle as="h1" className="text-2xl font-extrabold tracking-tight text-red-700">
              Access Denied
            </CardTitle>
            <p className="text-sm text-red-700/80">You do not have permission to open this section.</p>
          </CardHeader>
          <CardContent className="space-y-4 py-6">
            <p className="text-sm text-[#475569]">
              {user?.username ? (
                <>
                  Current user <span className="font-semibold text-[#0f172a]">{user.username}</span> is signed in as{' '}
                  <span className="font-semibold text-[#0f172a]">{user.role}</span>.
                </>
              ) : (
                'Your current session does not have the required role.'
              )}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/" className="flex-1">
                <Button className="w-full">Go to Dashboard</Button>
              </Link>
              <Link to="/login" className="flex-1">
                <Button variant="outline" className="w-full">
                  Switch Account
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ForbiddenPage
