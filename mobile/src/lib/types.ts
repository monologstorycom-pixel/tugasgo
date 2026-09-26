export type Role = 'ADMIN' | 'STAFF' | 'DRIVER'

export type AvailabilityStatus = 'AVAILABLE' | 'ON_LEAVE' | 'OFF_DUTY'

export type TaskStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export type TaskPriority = 'NORMAL' | 'URGENT'

export interface User {
  id: number
  name: string
  username: string
  role: Role
  phone: string | null
  division: string | null
  divisionId?: number | null
  status?: AvailabilityStatus
}

export interface Task {
  id: number
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  creatorId: number
  requester: string
  division: string
  assigneeId: number
  assignee: string
  destination: string
  address: string
  latitude: number | null
  longitude: number | null
  referencePhoto: string | null
  photos: string[] | null
  note: string | null
  cancelReason: string | null
  urgentDeadline: number | null
  scheduledAt: number | null
  completionLatitude: number | null
  completionLongitude: number | null
  created: number
  startedAt?: number
  completedAt?: number
  cancelledAt?: number
  durationSeconds?: number | null
}

export interface GpsPoint {
  latitude: number
  longitude: number
  accuracy: number | null
  recordedAt: string
}
