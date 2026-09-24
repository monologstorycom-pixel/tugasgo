import { useCallback, useEffect, useState } from 'react'
import type { Division, UserRecord, ApiRole } from '../types'
import { request } from '../lib/api'
import { Badge } from '../components/ui'

export default function Admin({ divisions, onReload, onOpenTasks }: { divisions: Division[]; onReload: () => void; onOpenTasks: () => void }) {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [tab, setTab] = useState<'drivers' | 'users' | 'divisions' | 'settings'>('drivers')
  const [guestMode, setGuestMode] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [guestError, setGuestError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showAddDiv, setShowAddDiv] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'DRIVER' as ApiRole, divisionId: '', phone: '' })
  const [editForm, setEditForm] = useState({ name: '', phone: '', divisionId: '', password: '' })
  const [divForm, setDivForm] = useState({ name: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    request<{ users: UserRecord[] }>('/admin/users').then(r => setUsers(r.users)).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    request<{ settings: Record<string, string> }>('/settings')
      .then(r => setGuestMode(r.settings.guest_mode === 'true'))
      .catch(() => {})
  }, [])

  const toggleGuestMode = async () => {
    setGuestLoading(true); setGuestError('')
    try {
      const next = !guestMode
      await request('/admin/settings', { method: 'PATCH', body: JSON.stringify({ guest_mode: String(next) }) })
      setGuestMode(next)
    } catch (e) { setGuestError(e instanceof Error ? e.message : 'Gagal mengubah Guest Mode') }
    finally { setGuestLoading(false) }
  }

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await request('/admin/users', { method: 'POST', body: JSON.stringify({ ...form, divisionId: form.divisionId ? Number(form.divisionId) : null }) })
      setShowAdd(false); setForm({ name: '', username: '', password: '', role: 'DRIVER', divisionId: '', phone: '' }); load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal') }
    finally { setBusy(false) }
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const p: Record<string, unknown> = { name: editForm.name, phone: editForm.phone || null, divisionId: editForm.divisionId ? Number(editForm.divisionId) : null }
      if (editForm.password) p.password = editForm.password
      await request(`/admin/users/${editId}`, { method: 'PATCH', body: JSON.stringify(p) })
      setEditId(null); load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal') }
    finally { setBusy(false) }
  }

  const toggle = async (id: number, active: boolean) => { await request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }); load() }
  const setDriverStatus = async (id: number, status: 'AVAILABLE' | 'ON_LEAVE') => { await request(`/drivers/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); load() }
  const removeUser = async (user: UserRecord) => {
    if (!window.confirm(`Hapus permanen ${user.name}? Semua tugas, notifikasi, dan lokasi terkait ikut terhapus. Tindakan ini tidak dapat dibatalkan.`)) return
    setBusy(true); setError('')
    try { await request(`/admin/users/${user.id}`, { method: 'DELETE' }); load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal menghapus pengguna') }
    finally { setBusy(false) }
  }
  const addDiv = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try { await request('/admin/divisions', { method: 'POST', body: JSON.stringify(divForm) }); setShowAddDiv(false); setDivForm({ name: '' }); onReload() }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal') }
    finally { setBusy(false) }
  }
  const toggleDiv = async (id: number, active: boolean) => { await request(`/admin/divisions/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }); onReload() }
  const removeDivision = async (division: Division) => {
    if (!window.confirm(`Hapus permanen divisi ${division.name}? Semua tugas divisi ikut terhapus dan pengguna dilepas dari divisi. Tindakan ini tidak dapat dibatalkan.`)) return
    setBusy(true); setError('')
    try { await request(`/admin/divisions/${division.id}`, { method: 'DELETE' }); onReload() }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal menghapus divisi') }
    finally { setBusy(false) }
  }

  const drivers = users.filter(u => u.role === 'DRIVER')
  const nonDrivers = users.filter(u => u.role !== 'DRIVER')

  return (
    <main className="page admin-page">
      <div className="page-head"><div><p className="eyebrow">MANAJEMEN SISTEM</p><h1>Admin panel</h1><p className="admin-page-subtitle">Kelola driver, pengguna, divisi, dan akses guest.</p></div></div>
      <div className="tab-bar admin-tabs" role="tablist" aria-label="Menu admin">
        <button className="admin-tasks-tab" onClick={onOpenTasks}>Semua tugas</button>
        <button role="tab" aria-selected={tab === 'drivers'} className={tab === 'drivers' ? 'active' : ''} onClick={() => setTab('drivers')}>Driver</button>
         <button role="tab" aria-selected={tab === 'users'} className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Pengguna</button>
         <button role="tab" aria-selected={tab === 'divisions'} className={tab === 'divisions' ? 'active' : ''} onClick={() => setTab('divisions')}>Divisi</button>
         <button role="tab" aria-selected={tab === 'settings'} className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Pengaturan</button>
      </div>

      {/* ── Tab Driver ── */}
      {tab === 'drivers' && (
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Status driver</h2>
              <p>{drivers.filter(d => d.active && d.availability_status === 'AVAILABLE').length} aktif · {drivers.filter(d => d.availability_status === 'ON_LEAVE').length} tidak masuk · {drivers.filter(d => d.availability_status === 'OFF_DUTY').length} pulang</p>
            </div>
            <button className="primary" onClick={() => { setForm(f => ({ ...f, role: 'DRIVER' })); setShowAdd(v => !v); setTab('users') }}>+ Tambah driver</button>
          </div>
          {error && <p className="error admin-error" role="alert">{error}</p>}
          {drivers.length === 0 && <div className="empty"><b>Belum ada driver</b></div>}
          <div className="driver-status-list">
            {drivers.map(d => (
              <div key={d.id} className={`driver-status-row ${!d.active ? 'off-duty' : ''}`}>
                <span className={`avatar ${d.active ? 'avatar-active' : ''}`}>{d.name[0]}</span>
                <div className="driver-status-info">
                  <b>{d.name}</b>
                  <small>{d.username}{d.phone ? ` · ${d.phone}` : ''}</small>
                </div>
                <div className={`driver-status-badge ${d.active && d.availability_status === 'AVAILABLE' ? 'on' : 'off'}`}>
                  {!d.active ? 'Nonaktif' : d.availability_status === 'ON_LEAVE' ? 'Tidak masuk' : d.availability_status === 'OFF_DUTY' ? 'Driver sudah pulang' : 'Aktif'}
                </div>
                <div className="admin-row-actions">
                  <button className={d.availability_status === 'AVAILABLE' ? 'secondary' : 'primary'} onClick={() => setDriverStatus(d.id, d.availability_status === 'AVAILABLE' ? 'ON_LEAVE' : 'AVAILABLE')}>{d.availability_status === 'AVAILABLE' ? 'Set Libur' : 'Set Aktif'}</button>
                  <button className="danger" onClick={() => removeUser(d)} disabled={busy}>Hapus</button>
                </div>
              </div>
            ))}
          </div>
          <div className="driver-status-note">
            <small>Driver berstatus <b>Tidak masuk</b> atau <b>Driver sudah pulang</b> tidak dapat dipilih saat membuat tugas baru.</small>
          </div>
        </section>
      )}

      {/* ── Tab Pengguna ── */}
      {tab === 'users' && (
        <section className="panel">
          <div className="section-title"><div><h2>Pengguna</h2></div><button className="primary" onClick={() => setShowAdd(v => !v)}>+ Tambah</button></div>
          {showAdd && (
            <form className="form inline-form" onSubmit={addUser}>
              <div className="form-grid">
                <label>Nama<input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></label>
                <label>Username<input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required /></label>
                <label>Password<input type="password" minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></label>
                <label>Role<select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as ApiRole }))}><option value="DRIVER">Driver</option><option value="STAFF">Staff</option><option value="ADMIN">Admin</option></select></label>
                <label>Divisi<select value={form.divisionId} onChange={e => setForm(f => ({ ...f, divisionId: e.target.value }))}><option value="">— Tidak ada —</option>{divisions.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
                <label>No. HP<input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></label>
              </div>
              {error && <p className="error">{error}</p>}
              <div className="form-actions"><button type="button" className="secondary" onClick={() => setShowAdd(false)}>Batal</button><button className="primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
            </form>
          )}
          {!showAdd && error && <p className="error admin-error" role="alert">{error}</p>}
          <div className="user-list">
            {nonDrivers.map(u => (
              <div key={u.id}>
                <div className={`user-row ${!u.active ? 'inactive' : ''}`}>
                  <span className="avatar">{u.name[0]}</span>
                  <div><b>{u.name}</b> <Badge>{u.role}</Badge><small>{u.username}{u.division_name ? ` · ${u.division_name}` : ''}{u.phone ? ` · ${u.phone}` : ''}</small></div>
                  <div className="user-row-actions">
                    <button className="secondary" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => editId === u.id ? setEditId(null) : (setEditId(u.id), setEditForm({ name: u.name, phone: u.phone || '', divisionId: String(divisions.find(d => d.name === u.division_name)?.id || ''), password: '' }))}>{editId === u.id ? 'Tutup' : 'Edit'}</button>
                     <button className={u.active ? 'secondary' : 'primary'} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => toggle(u.id, !u.active)}>{u.active ? 'Nonaktif' : 'Aktifkan'}</button>
                     <button className="danger" onClick={() => removeUser(u)} disabled={busy}>Hapus</button>
                   </div>
                </div>
                {editId === u.id && (
                  <form className="form inline-form" onSubmit={saveEdit}>
                    <div className="form-grid">
                      <label>Nama<input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required /></label>
                      <label>No. HP<input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></label>
                      <label>Divisi<select value={editForm.divisionId} onChange={e => setEditForm(f => ({ ...f, divisionId: e.target.value }))}><option value="">— Tidak ada —</option>{divisions.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
                      <label>Password baru<input type="password" minLength={6} value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimal 6 karakter; kosongkan jika tidak diubah" /></label>
                    </div>
                    {error && <p className="error">{error}</p>}
                    <div className="form-actions"><button type="button" className="secondary" onClick={() => setEditId(null)}>Batal</button><button className="primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Tab Divisi ── */}
      {tab === 'divisions' && (
        <section className="panel">
          <div className="section-title"><div><h2>Divisi</h2></div><button className="primary" onClick={() => setShowAddDiv(v => !v)}>+ Tambah</button></div>
          {showAddDiv && (
            <form className="form inline-form" onSubmit={addDiv}>
              <label>Nama divisi<input value={divForm.name} onChange={e => setDivForm({ name: e.target.value })} required /></label>
              {error && <p className="error">{error}</p>}
              <div className="form-actions"><button type="button" className="secondary" onClick={() => setShowAddDiv(false)}>Batal</button><button className="primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
            </form>
          )}
          {!showAddDiv && error && <p className="error admin-error" role="alert">{error}</p>}
          <div className="user-list">
            {divisions.map(d => (
              <div key={d.id} className={`user-row ${!d.active ? 'inactive' : ''}`}>
                <span className="avatar">{d.name[0]}</span>
                <div><b>{d.name}</b></div>
                <div className="admin-row-actions">
                  <button className={d.active ? 'secondary' : 'primary'} onClick={() => toggleDiv(d.id, !d.active)}>{d.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                  <button className="danger" onClick={() => removeDivision(d)} disabled={busy}>Hapus</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Tab Pengaturan ── */}
      {tab === 'settings' && (
        <section className="panel">
          <div className="section-title"><div><h2>Pengaturan sistem</h2></div></div>
          <div className="settings-list">
            <div className="settings-row">
              <div>
                <b>Guest Mode</b>
                <small>Form tugas tanpa login tersedia melalui link khusus <code>/tugasgo</code></small>
              </div>
              <button
                className={guestMode ? 'primary' : 'secondary'}
                onClick={toggleGuestMode}
                disabled={guestLoading}
                style={{ minWidth: 100 }}
              >
                {guestLoading ? '…' : guestMode ? '✓ Aktif' : 'Nonaktif'}
              </button>
            </div>
            {guestError && <p className="error">{guestError}</p>}
            {guestMode && (
              <div className="guest-link-box">
                <small>Link form buat tugas:</small>
                <code>{window.location.origin}/tugasgo</code>
                <button className="secondary" style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/tugasgo`)}>
                  Salin
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  )
}
