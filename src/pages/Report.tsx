import { useEffect, useState } from 'react'
import { request, duration } from '../lib/api'

type DriverRow = { id: number; name: string; total: number; completed: number; cancelled: number; waiting: number; in_progress: number; total_seconds: number; avg_seconds: number }
type DivRow = { id: number; name: string; total: number; completed: number; waiting: number; in_progress: number; cancelled: number }

export default function Report() {
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [divs, setDivs] = useState<DivRow[]>([])

  useEffect(() => {
    request<{ drivers: DriverRow[] }>('/reports/drivers').then(r => setDrivers(r.drivers)).catch(() => {})
    request<{ divisions: DivRow[] }>('/reports/divisions').then(r => setDivs(r.divisions)).catch(() => {})
  }, [])

  return (
    <main className="page">
      <div className="page-head"><div><h1>Statistik operasional</h1></div></div>
      <section className="panel report-table">
        <div className="section-title"><div><h2>Per Driver</h2></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Driver</th><th>Total</th><th>Selesai</th><th>Batal</th><th>Waiting</th><th>Aktif</th><th>Total durasi</th><th>Rata-rata</th></tr></thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.id}>
                  <td>{d.name}</td><td>{d.total}</td><td>{d.completed}</td><td>{d.cancelled}</td><td>{d.waiting}</td><td>{d.in_progress}</td>
                  <td>{d.total_seconds ? duration(d.total_seconds) : '—'}</td>
                  <td>{d.avg_seconds ? duration(d.avg_seconds) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel report-table" style={{ marginTop: 20 }}>
        <div className="section-title"><div><h2>Per Divisi</h2></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Divisi</th><th>Total</th><th>Selesai</th><th>Waiting</th><th>Aktif</th><th>Batal</th></tr></thead>
            <tbody>
              {divs.map(d => <tr key={d.id}><td>{d.name}</td><td>{d.total}</td><td>{d.completed}</td><td>{d.waiting}</td><td>{d.in_progress}</td><td>{d.cancelled}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
