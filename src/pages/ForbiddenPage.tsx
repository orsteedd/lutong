import { Link } from 'react-router-dom'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components'

const ForbiddenPage = () => {
  return (
    <div className="min-h-screen bg-[#edf4f1] flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-amber-200 bg-white">
        <CardHeader>
          <CardTitle as="h1" className="text-2xl text-amber-800">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[#475569]">
            Your account does not have permission to view this page.
          </p>
          <Link to="/" className="block">
            <Button className="w-full h-11">Go to Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

export default ForbiddenPage
