import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components'
import { useAuthStore } from '@/store'

const AdminPage = () => {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const isAdmin = user?.role === 'admin'
  const [activePanel, setActivePanel] = useState<'add' | 'permissions' | null>(null)

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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_360px]">
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
                onClick={() => setActivePanel('add')}
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
                onClick={() => setActivePanel('permissions')}
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

        <Card>
          <CardHeader>
            <CardTitle as="h2">Command Side Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activePanel === null && (
              <p className="text-sm text-[#64748b]">
                Select Add Employee or Set Permissions to edit details without leaving the command center.
              </p>
            )}

            {activePanel === 'add' && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-[#111827]">Add Employee</p>
                <label className="block text-xs text-[#64748b]">
                  Full Name
                  <input
                    type="text"
                    className="mt-1 h-10 w-full rounded-xl border border-[#dceae4] bg-white px-3 text-sm"
                    placeholder="e.g. Maria Santos"
                    disabled={!isAdmin}
                  />
                </label>
                <label className="block text-xs text-[#64748b]">
                  Username
                  <input
                    type="text"
                    className="mt-1 h-10 w-full rounded-xl border border-[#dceae4] bg-white px-3 text-sm"
                    placeholder="e.g. maria.s"
                    disabled={!isAdmin}
                  />
                </label>
                <label className="block text-xs text-[#64748b]">
                  Role
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-[#dceae4] bg-white px-3 text-sm"
                    disabled={!isAdmin}
                  >
                    <option>staff</option>
                    <option>admin</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <Button className="h-9" disabled={!isAdmin}>Save Employee</Button>
                  <Button variant="outline" className="h-9" onClick={() => setActivePanel(null)}>Close</Button>
                </div>
              </div>
            )}

            {activePanel === 'permissions' && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-[#111827]">Set Permissions</p>
                <label className="block text-xs text-[#64748b]">
                  Employee
                  <input
                    type="text"
                    className="mt-1 h-10 w-full rounded-xl border border-[#dceae4] bg-white px-3 text-sm"
                    placeholder="Select employee"
                    disabled={!isAdmin}
                  />
                </label>
                <label className="block text-xs text-[#64748b]">
                  Access Level
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-[#dceae4] bg-white px-3 text-sm"
                    disabled={!isAdmin}
                  >
                    <option>Inventory + Delivery + Scan + Reports</option>
                    <option>Inventory + Scan</option>
                    <option>Read Only</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <Button className="h-9" disabled={!isAdmin}>Save Permissions</Button>
                  <Button variant="outline" className="h-9" onClick={() => setActivePanel(null)}>Close</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AdminPage
