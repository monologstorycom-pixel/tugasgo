import { useCallback, useEffect, useState } from 'react'
import type { Division, UserRecord, ApiRole } from '../types'
import { request } from '../lib/api'
import { Badge } from '../components/ui'

export default function Admin({ divisions, onReload }: { divisions: Division[]; onReload: () => void }) {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [tab, setTab] = useState<'drivers' | 'users' | 'divisions' | 'settings'>('drivers')
  const [guestMode, setGuestMode] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
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
    setGuestLoading(true)
    try {
      const next = !guestMode
      await request('/admin/settings', { method: 'PATCH', body: JSON.stringify({ guest_mode: String(next) }) })
      setGuestMode(next)
    } catch { /* silent */ }
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
  const addDiv = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try { await request('/admin/divisions', { method: 'POST', body: JSON.stringify(divForm) }); setShowAddDiv(false); setDivForm({ name: '' }); onReload() }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal') }
    finally { setBusy(false) }
  }
  const toggleDiv = async (id: number, active: boolean) => { await request(`/admin/divisions/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }); onReload() }

  const drivers = users.filter(u => u.role === 'DRIVER')
  const nonDrivers = users.filter(u => u.role !== 'DRIVER')

  return (
    <main className="page">
      <div className="page-head"><div><h1>Admin panel</h1></div></div>
      <div className="tab-bar">
        <button className={tab === 'drivers' ? 'active' : ''} onClick={() => setTab('drivers')}>Driver</button>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Pengguna</button>
        <button className={tab === 'divisions' ? 'active' : ''} onClick={() => setTab('divisions')}>Divisi</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Pengaturan</button>
      </div>

      {/* ── Tab Driver ── */}
      {tab === 'drivers' && (
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Status driver</h2>
              <p>{drivers.filter(d => d.active).length} aktif · {drivers.filter(d => !d.active).length} libur</p>
            </div>
            <button className="primary" onClick={() => { setForm(f => ({ ...f, role: 'DRIVER' })); setShowAdd(v => !v); setTab('users') }}>+ Tambah driver</button>
          </div>
          {drivers.length === 0 && <div className="empty"><b>Belum ada driver</b></div>}
          <div className="driver-status-list">
            {drivers.map(d => (
              <div key={d.id} className={`driver-status-row ${!d.active ? 'off-duty' : ''}`}>
                <span className={`avatar ${d.active ? 'avatar-active' : ''}`}>{d.name[0]}</span>
                <div className="driver-status-info">
                  <b>{d.name}</b>
                  <small>{d.username}{d.phone ? ` · ${d.phone}` : ''}</small>
                </div>
                <div className={`driver-status-badge ${d.active ? 'on' : 'off'}`}>
                  {d.active ? 'Aktif' : 'Libur'}
                </div>
                <button
                  className={d.active ? 'secondary' : 'primary'}
                  style={{ fontSize: 12, padding: '6px 12px', minHeight: 'unset' }}
                  onClick={() => toggle(d.id, !d.active)}
                >
                  {d.active ? 'Set Libur' : 'Set Aktif'}
                </button>
              </div>
            ))}
          </div>
          <div className="driver-status-note">
            <small>Driver berstatus <b>Libur</b> tidak dapat dipilih saat membuat tugas baru.</small>
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
                <label>Password<input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required /></label>
                <label>Role<select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as ApiRole }))}><option value="DRIVER">Driver</option><option value="STAFF">Staff</option><option value="ADMIN">Admin</option></select></label>
                <label>Divisi<select value={form.divisionId} onChange={e => setForm(f => ({ ...f, divisionId: e.target.value }))}><option value="">— Tidak ada —</option>{divisions.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
                <label>No. HP<input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></label>
              </div>
              {error && <p className="error">{error}</p>}
              <div className="form-actions"><button type="button" className="secondary" onClick={() => setShowAdd(false)}>Batal</button><button className="primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button></div>
            </form>
          )}
          <div className="user-list">
            {nonDrivers.map(u => (
              <div key={u.id}>
                <div className={`user-row ${!u.active ? 'inactive' : ''}`}>
                  <span className="avatar">{u.name[0]}</span>
                  <div><b>{u.name}</b> <Badge>{u.role}</Badge><small>{u.username}{u.division_name ? ` · ${u.division_name}` : ''}{u.phone ? ` · ${u.phone}` : ''}</small></div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="secondary" style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => editId === u.id ? setEditId(null) : (setEditId(u.id), setEditForm({ name: u.name, phone: u.phone || '', divisionId: String(divisions.find(d => d.name === u.division_name)?.id || ''), password: '' }))}>{editId === u.id ? 'Tutup' : 'Edit'}</button>
                    <button className={u.active ? 'secondary' : 'primary'} style={{ fontSize: 12, padding: '6px 10px' }} onClick={() => toggle(u.id, !u.active)}>{u.active ? 'Nonaktif' : 'Aktifkan'}</button>
                  </div>
                </div>
                {editId === u.id && (
                  <form className="form inline-form" onSubmit={saveEdit}>
                    <div className="form-grid">
                      <label>Nama<input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} required /></label>
                      <label>No. HP<input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></label>
                      <label>Divisi<select value={editForm.divisionId} onChange={e => setEditForm(f => ({ ...f, divisionId: e.target.value }))}><option value="">— Tidak ada —</option>{divisions.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
                      <label>Password baru<input type="password" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} placeholder="Kosongkan jika tidak diubah" /></label>
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
          <div className="user-list">
            {divisions.map(d => (
              <div key={d.id} className={`user-row ${!d.active ? 'inactive' : ''}`}>
                <span className="avatar">{d.name[0]}</span>
                <div><b>{d.name}</b></div>
                <button className={d.active ? 'secondary' : 'primary'} onClick={() => toggleDiv(d.id, !d.active)}>{d.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
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
                <small>Staff dapat membuat tugas tanpa login. Form buka tugas tersedia di <code>/buat-tugas</code></small>
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
            {guestMode && (
              <div className="guest-link-box">
                <small>Link form buat tugas:</small>
                <code>{window.location.origin}/#/buat-tugas</code>
                <button className="secondary" style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/#/buat-tugas`)}>
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
