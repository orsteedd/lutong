import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components'
import { useAuthStore } from '@/store'

const LoginPage = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isLoggingIn = useAuthStore((state) => state.isLoggingIn)
  const error = useAuthStore((state) => state.error)
  const login = useAuthStore((state) => state.login)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedUsername = username.trim()
    if (!trimmedUsername || !password) return
    await login(trimmedUsername, password)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,#d8efe6_0%,#edf4f1_40%,#d3e8df_100%)] px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <Card className="border-[#bcd9cd] bg-white/95 shadow-[0_24px_64px_rgba(15,23,42,0.12)]">
          <CardHeader className="border-b border-[#deece5]">
            <CardTitle as="h1" className="text-2xl font-extrabold tracking-tight">
              Malatang Login
            </CardTitle>
            <p className="text-sm text-[#64748b]">Sign in to access inventory operations.</p>
          </CardHeader>
          <CardContent className="space-y-4 py-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label className="text-sm font-medium text-[#334155]" htmlFor="username">
                  Username
                </label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin"
                  disabled={isLoggingIn}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-[#334155]" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                  disabled={isLoggingIn}
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoggingIn || username.trim() === '' || password === ''}
              >
                {isLoggingIn ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Dev credentials: admin / admin1234 or staff / staff1234
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default LoginPage
