import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components'
import { useAuthStore } from '@/store'

const AdminPage = () => {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin'
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false)
  const [permissionsOpen, setPermissionsOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] mb-1">Admin</h1>
        <p className="text-[#64748b]">Employee management and activity logs only.</p>
      </div>

      {!isAdmin && (
        <Card className="border-amber-200 bg-amber-50/80">
          <CardContent className="py-4">
            <p className="text-sm text-amber-900">
              This section is limited to admin users. Current session: {user?.username || 'unknown'} ({user?.role || 'unknown'}).
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Employee Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-[#dceae4] bg-white p-3">
              <p className="text-sm font-semibold text-[#111827]">Add Employee</p>
              <p className="text-xs text-[#64748b] mt-1">Create staff accounts for operational access.</p>
              <Button
                variant="outline"
                className="h-9 mt-3"
                disabled={!isAdmin}
                onClick={() => setAddEmployeeOpen(true)}
              >
                Add Employee
              </Button>
            </div>
            <div className="rounded-xl border border-[#dceae4] bg-white p-3">
              <p className="text-sm font-semibold text-[#111827]">Set Permissions</p>
              <p className="text-xs text-[#64748b] mt-1">Assign roles and module access levels.</p>
              <Button
                variant="outline"
                className="h-9 mt-3"
                disabled={!isAdmin}
                onClick={() => setPermissionsOpen(true)}
              >
                Set Permissions
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Activity Logs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[#334155]">
              Review operational activity, approval events, and inventory adjustments.
            </p>
            <Button
              className="h-10"
              disabled={!isAdmin}
              onClick={() => navigate('/activity')}
            >
              Open Activity Logs
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={addEmployeeOpen} onOpenChange={setAddEmployeeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-[#475569]">
              Employee creation UI is intentionally streamlined for this phase. Connect this action to your backend employee endpoint.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose className="h-10 rounded-xl border border-gray-300 px-4 text-sm font-medium text-black hover:bg-gray-100">
              Close
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Permissions</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-[#475569]">
              Permission management UI is intentionally streamlined for this phase. Connect this action to your backend role management endpoint.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose className="h-10 rounded-xl border border-gray-300 px-4 text-sm font-medium text-black hover:bg-gray-100">
              Close
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminPage
