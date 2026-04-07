import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components'
import { useAuthStore } from '@/store/useAuthStore'

const LoginPage = () => {
  const user = useAuthStore((state) => state.user)
  const login = useAuthStore((state) => state.login)
  const isLoading = useAuthStore((state) => state.isLoading)
  const authError = useAuthStore((state) => state.error)

  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin1234')
  const [message, setMessage] = useState<string | null>(null)

  if (user) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setMessage(null)

    const result = await login(username, password)
    if (!result.ok) {
      setMessage(result.error || 'Login failed.')
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#FDECEC_0%,#f8f4f2_45%,#f5f5f4_100%)] flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-[#F3C4C4] bg-white">
        <CardHeader>
          <CardTitle as="h1" className="text-2xl text-[#111827]">Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium text-[#334155]">Username</label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-[#334155]">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {(message || authError) && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {message || authError}
              </p>
            )}

            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>

            <p className="text-xs text-[#64748b]">
              Demo accounts: admin/admin1234 or staff/staff1234
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginPage
