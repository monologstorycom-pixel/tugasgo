import type { Task } from '../types'
import { age, waitingAge, isOverDeadline, deadlineLabel, dateTime } from '../lib/api'
import { Badge } from './ui'

export default function TaskRow({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const over = isOverDeadline(task)
  const dlLabel = deadlineLabel(task)
  const isScheduled = task.scheduledAt != null && task.status === 'WAITING' && Date.now() < task.scheduledAt

  return (
    <button className={`task-row ${over ? 'overdue' : ''}`} onClick={() => onOpen(task)}>
      <span className={`priority-dot ${task.priority.toLowerCase()}`} />
      <div className="task-main">
        <div className="task-title-row">
          <b>{task.title}</b>
          <div className="task-badges">
            {task.priority === 'URGENT' && <Badge tone="red">URGENT</Badge>}
            {isScheduled && <Badge tone="orange">DIJADWALKAN</Badge>}
            {task.status === 'IN_PROGRESS' && <Badge tone="blue">BERJALAN</Badge>}
            {task.status === 'CANCELLED' && <Badge tone="red">BATAL</Badge>}
            {task.status === 'COMPLETED' && <Badge tone="green">SELESAI</Badge>}
            {over && <Badge tone="red">LEWAT BATAS</Badge>}
          </div>
        </div>
        <small className="task-sub">{task.destination} · {task.requester}</small>
        {isScheduled && (
          <span className="task-schedule">Dijadwalkan: {dateTime(task.scheduledAt!)}</span>
        )}
        {dlLabel && !['COMPLETED','CANCELLED'].includes(task.status) && (
          <span className={over ? 'task-deadline over' : 'task-deadline'}>{dlLabel}</span>
        )}
        <small className="task-age">
          {task.status === 'WAITING' ? `${waitingAge(task.created)} belum dikerjakan` : `${age(task.created)} lalu`}
        </small>
      </div>
      <i className="task-arrow">›</i>
    </button>
  )
}
