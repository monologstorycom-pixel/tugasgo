export type Role = 'Staff' | 'Driver' | 'Admin'
export type ApiRole = 'STAFF' | 'DRIVER' | 'ADMIN'
export type Status = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type Priority = 'NORMAL' | 'URGENT'
export type View = 'dashboard' | 'create' | 'activity' | 'history' | 'detail' | 'report' | 'admin'

export type SessionUser = { id: number; name: string; username: string; role: ApiRole; divisionId: number | null }
export type Task = {
  id: number; title: string; priority: Priority; status: Status; created: number
  creatorId: number; requester: string; division: string
  assigneeId: number; assignee: string; destination: string; address: string; description: string
  latitude?: number | null; longitude?: number | null
  referencePhoto?: string; startedAt?: number; completedAt?: number
  cancelledAt?: number; cancelReason?: string; cancelledBy?: number | null
  note?: string; photos?: string[]
  completionLatitude?: number | null; completionLongitude?: number | null
  durationSeconds?: number | null
  urgentDeadline?: number | null
  scheduledAt?: number | null
}
export type TaskDraft = {
  title: string; priority: Priority; division: string; assignee: string
  destination: string; address: string; description: string
  referencePhoto?: string; latitude?: number | null; longitude?: number | null
  urgentDeadline?: string | null
  scheduledAt?: string | null
}
export type DriverOption = { id: number; name: string }
export type Notification = { id: number; type: string; taskId: number; message: string; read_at: string | null; created_at: string }
export type DriverLocation = { driverId: number; driverName: string; taskId: number | null; latitude: number; longitude: number; accuracy: number | null; updatedAt: number; taskTitle?: string | null; requester?: string | null; destination?: string | null; address?: string | null; division?: string | null }
export type Division = { id: number; name: string; active: boolean }
export type UserRecord = { id: number; name: string; username: string; role: ApiRole; phone: string | null; active: boolean; availability_status: 'AVAILABLE' | 'ON_LEAVE'; division_name: string | null }
export type TaskEvent = { id: number; taskId: number; actorId: number; actor_name: string; event_type: string; created_at: string }
export type PlaceResult = { name: string; address: string; lat: number; lng: number }
