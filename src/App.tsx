import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Role = 'Staff' | 'Driver' | 'Admin'
type Status = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type Priority = 'NORMAL' | 'URGENT'
type Task = { id:number; title:string; priority:Priority; status:Status; created:number; requester:string; division:string; destination:string; description:string; note?:string }
type View = 'dashboard' | 'create' | 'activity' | 'history' | 'detail'

const now = Date.now()
const seed: Task[] = [
  { id:1, title:'Beli Kabel LAN', priority:'NORMAL', status:'WAITING', created:now-1000*60*60*5, requester:'Andi Purchasing', division:'Purchasing', destination:'Toko Sumber Network', description:'Beli kabel LAN Cat6 sepanjang 50 meter untuk ruang meeting lantai 2.' },
  { id:2, title:'Antar Dokumen Kontrak', priority:'URGENT', status:'WAITING', created:now-1000*60*60*9, requester:'Budi Accounting', division:'Accounting', destination:'Kantor Notaris Graha Pena', description:'Antarkan map kontrak bertanda merah. Serahkan langsung kepada Ibu Ratna.' },
  { id:3, title:'Ambil Perangkat Service', priority:'NORMAL', status:'IN_PROGRESS', created:now-1000*60*60*2, requester:'Dimas IT', division:'IT', destination:'Service Center WTC', description:'Ambil laptop service dengan nomor tiket IT-284.' },
  { id:4, title:'Kirim Pantry Supply', priority:'NORMAL', status:'COMPLETED', created:now-1000*60*60*29, requester:'Sari GA', division:'GA', destination:'Gudang ASM', description:'Kirim stok pantry ke gudang.', note:'Diterima Pak Eko' },
]

const sortDriverTasks = (tasks: Task[]) => [...tasks].filter(t=>t.status!=='COMPLETED'&&t.status!=='CANCELLED').sort((a,b)=>{
  const rank = (t:Task) => t.status==='IN_PROGRESS' ? 0 : t.priority==='URGENT' ? 1 : 2
  return rank(a)-rank(b) || a.created-b.created
})

const age = (created:number) => { const h=Math.max(1,Math.floor((Date.now()-created)/3600000)); return h<24 ? `${h} jam` : `${Math.floor(h/24)} hari` }
const waitingAge = (created:number) => { const h=Math.max(1,Math.floor((Date.now()-created)/3600000)); return h<24 ? `${h} jam` : `${Math.floor(h/24)} hari ${h%24} jam` }
const duration = (seconds:number) => [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':')

function Logo({variant='wordmark'}:{variant?:'wordmark'|'icon'|'lockup'}){ const src={wordmark:'/image/logo.png',icon:'/image/logo1.png',lockup:'/image/logo-real.png'}[variant]; return <img className={`logo logo-${variant}`} src={src} alt="TugasGo"/> }
function Badge({children, tone='gray'}:{children:React.ReactNode,tone?:string}){return <span className={`badge ${tone}`}>{children}</span>}

function Login({onLogin}:{onLogin:(r:Role)=>void}){
 const roles:[Role,string,string][]=[['Staff','Andi Purchasing','Buat dan pantau tugas'],['Driver','Risen Driver','Kerjakan tugas lapangan'],['Admin','Admin','Pantau seluruh aktivitas']]
 return <main className="login"><section className="login-brand"><Logo variant="lockup"/><div><p className="eyebrow">OPERASIONAL HARIAN</p><h1>Tugas beres.<br/>Pergerakan jelas.</h1><p>Koordinasi tugas lapangan antar divisi dalam satu alur yang ringkas.</p></div><small>Prototype internal ASM · Data demo</small></section><section className="login-panel"><div className="login-box"><p className="eyebrow">MASUK MODE DEMO</p><h2>Pilih peran</h2><p className="muted">Tidak memerlukan kata sandi.</p><div className="role-list">{roles.map(([r,n,d])=><button key={r} onClick={()=>onLogin(r)} className="role"><span className="avatar">{n[0]}</span><span><b>{n}</b><small>{r} · {d}</small></span><i>›</i></button>)}</div></div></section></main>
}

function Shell({role,view,setView,logout,children}:{role:Role,view:View,setView:(v:View)=>void,logout:()=>void,children:React.ReactNode}){
 const items:Record<Role,[View,string][]>= {Staff:[['dashboard','Ringkasan'],['create','Buat tugas'],['history','Riwayat']],Driver:[['dashboard','Tugas saya'],['activity','Aktivitas'],['history','Riwayat']],Admin:[['dashboard','Overview'],['activity','Aktivitas']]}
 const names={Staff:'Andi Purchasing',Driver:'Risen Driver',Admin:'Admin'}
 return <div className="shell"><aside><Logo/><nav>{items[role].map(([v,l])=><button className={view===v?'active':''} key={v} onClick={()=>setView(v)}><span>{v==='dashboard'?'⌂':v==='create'?'+':v==='activity'?'≡':'↺'}</span>{l}</button>)}</nav><div className="profile"><span className="avatar">{names[role][0]}</span><div><b>{names[role]}</b><small>{role}</small></div><button title="Keluar" onClick={logout}>↗</button></div></aside><div className="workspace"><header><div className="mobile-logo"><Logo variant="icon"/></div><span className="live"><i/> Data prototype lokal</span><button className="mobile-exit" onClick={logout}>Keluar</button></header>{children}<nav className="bottom-nav">{items[role].map(([v,l])=><button className={view===v?'active':''} key={v} onClick={()=>setView(v)}><span>{v==='dashboard'?'⌂':v==='create'?'+':v==='activity'?'≡':'↺'}</span>{l}</button>)}</nav></div></div>
}

function TaskRow({task,onOpen}:{task:Task,onOpen:(t:Task)=>void}){return <button className="task-row" onClick={()=>onOpen(task)}><span className={`priority-dot ${task.priority.toLowerCase()}`}/><span className="task-main"><span><b>{task.title}</b>{task.status==='IN_PROGRESS'&&<Badge tone="blue">SEDANG DIKERJAKAN</Badge>}</span><small>{task.destination} · {task.requester}</small></span><span className="task-meta"><Badge tone={task.priority==='URGENT'?'red':'gray'}>{task.priority}</Badge><small>{task.status==='WAITING'?`Sudah ${waitingAge(task.created)} belum dikerjakan`:`${age(task.created)} lalu`}</small></span><i>›</i></button>}

function StaffDashboard({tasks,onOpen,setView}:{tasks:Task[],onOpen:(t:Task)=>void,setView:(v:View)=>void}){
 const mine=tasks.filter(t=>t.requester.includes('Andi'))
 return <main className="page"><div className="page-head"><div><p className="eyebrow">SENIN, 21 SEPTEMBER</p><h1>Selamat siang, Andi.</h1><p>Berikut pergerakan tugas dari Purchasing.</p></div><button className="primary" onClick={()=>setView('create')}>+ Buat tugas</button></div><section className="stats"><div><small>TUGAS AKTIF</small><strong>{mine.filter(t=>t.status!=='COMPLETED'&&t.status!=='CANCELLED').length}</strong><p>perlu dipantau</p></div><div><small>SEDANG DIKERJAKAN</small><strong>{mine.filter(t=>t.status==='IN_PROGRESS').length}</strong><p>oleh driver</p></div><div><small>SELESAI</small><strong>{mine.filter(t=>t.status==='COMPLETED').length}</strong><p>hari ini</p></div></section><section className="panel"><div className="section-title"><div><h2>Tugas terbaru</h2><p>Status permintaan dari divisi Anda</p></div></div><div className="task-list">{mine.map(t=><TaskRow key={t.id} task={t} onOpen={onOpen}/>)}</div></section></main>
}

function CreateTask({onCreate,onCancel}:{onCreate:(t:Omit<Task,'id'|'created'|'status'|'requester'>)=>void,onCancel:()=>void}){
 const [title,setTitle]=useState(''); const [destination,setDestination]=useState(''); const [priority,setPriority]=useState<Priority>('NORMAL'); const [description,setDescription]=useState(''); const [error,setError]=useState('')
 const submit=(e:React.FormEvent)=>{e.preventDefault();if(!title.trim()||!destination.trim()){setError('Judul dan tujuan wajib diisi.');return}onCreate({title:title.trim(),destination:destination.trim(),priority,description:description.trim()||'Tidak ada detail tambahan.',division:'Purchasing'})}
 return <main className="page narrow"><button className="back" onClick={onCancel}>‹ Kembali</button><div className="page-head"><div><p className="eyebrow">PERMINTAAN BARU</p><h1>Buat tugas lapangan</h1><p>Berikan instruksi singkat dan jelas untuk driver.</p></div></div><form className="form panel" onSubmit={submit}><label>Judul tugas<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Contoh: Ambil dokumen vendor" autoFocus/></label><div className="form-grid"><label>Divisi<input value="Purchasing" disabled/></label><label>Prioritas<select value={priority} onChange={e=>setPriority(e.target.value as Priority)}><option>NORMAL</option><option>URGENT</option></select></label></div><label>Lokasi tujuan<input value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Nama tempat atau alamat"/></label><label>Instruksi<textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Barang yang dibawa, PIC tujuan, atau catatan lain" rows={4}/></label><div className="map-placeholder"><span>⌖</span><div><b>Pratinjau lokasi</b><small>Placeholder peta — tanpa Google Maps</small></div></div>{error&&<p className="error">{error}</p>}<div className="form-actions"><button type="button" className="secondary" onClick={onCancel}>Batal</button><button className="primary">Buat tugas</button></div></form></main>
}

function DriverDashboard({tasks,onOpen}:{tasks:Task[],onOpen:(t:Task)=>void}){
 const sorted=useMemo(()=>sortDriverTasks(tasks),[tasks]);
 return <main className="page driver-page"><div className="page-head"><div><p className="eyebrow">TUGAS HARI INI</p><h1>Halo, Risen.</h1><p>{sorted.length} tugas menunggu tindakan Anda.</p></div><span className="availability"><i/> Siap bertugas</span></div>{sorted[0]?.status==='IN_PROGRESS'&&<section className="current"><p className="eyebrow">SEDANG DIKERJAKAN</p><h2>{sorted[0].title}</h2><p>{sorted[0].destination}</p><button onClick={()=>onOpen(sorted[0])}>Lanjutkan tugas <span>›</span></button></section>}<section className="panel queue"><div className="section-title"><div><h2>Antrean tugas</h2><p>Urutan: aktif, urgent terlama, lalu normal terlama</p></div><Badge>{sorted.length} TUGAS</Badge></div><div className="task-list">{sorted.filter((_,i)=>sorted[0]?.status!=='IN_PROGRESS'||i>0).map(t=><TaskRow key={t.id} task={t} onOpen={onOpen}/>)}</div></section></main>
}

function Detail({task,onBack,onUpdate}:{task:Task,onBack:()=>void,onUpdate:(id:number,patch:Partial<Task>)=>void}){
 const [seconds,setSeconds]=useState(task.status==='IN_PROGRESS'?742:0); const [complete,setComplete]=useState(false); const [note,setNote]=useState(''); const [photo,setPhoto]=useState('')
 useEffect(()=>{if(task.status!=='IN_PROGRESS')return;const i=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(i)},[task.status])
 if(complete)return <main className="page narrow"><button className="back" onClick={()=>setComplete(false)}>‹ Kembali</button><div className="page-head"><div><p className="eyebrow">BUKTI PENYELESAIAN</p><h1>Selesaikan tugas</h1><p>Tambahkan foto dan catatan singkat.</p></div></div><div className="panel form"><label className="upload">{photo?<><span className="photo-preview">FOTO</span><b>{photo}</b><small>Klik untuk ganti foto</small></>:<><span>＋</span><b>Tambah foto bukti</b><small>JPG/PNG · Preview lokal saja</small></>}<input type="file" accept="image/*" onChange={e=>setPhoto(e.target.files?.[0]?.name||'')} /></label><label>Catatan penyelesaian<textarea rows={4} value={note} onChange={e=>setNote(e.target.value)} placeholder="Contoh: Dokumen diterima oleh Ibu Ratna"/></label><button className="primary full" onClick={()=>onUpdate(task.id,{status:'COMPLETED',note:note||'Tugas selesai tanpa catatan.'})}>Konfirmasi selesai</button></div></main>
 return <main className="page narrow"><button className="back" onClick={onBack}>‹ Kembali ke tugas</button><article className="detail panel"><div className="detail-top"><div><Badge tone={task.priority==='URGENT'?'red':'gray'}>{task.priority}</Badge><h1>{task.title}</h1><p>Dibuat {age(task.created)} lalu oleh {task.requester}</p></div>{task.status==='IN_PROGRESS'&&<div className="timer"><small>DURASI BERJALAN</small><strong>{duration(seconds)}</strong></div>}</div><div className="map-large"><span>⌖</span><div className="route-line"/><small>PLACEHOLDER PETA</small></div><div className="detail-grid"><div><small>TUJUAN</small><b>{task.destination}</b></div><div><small>DIVISI</small><b>{task.division}</b></div></div><div className="instruction"><small>INSTRUKSI</small><p>{task.description}</p></div>{task.status==='WAITING'?<button className="primary full" onClick={()=>onUpdate(task.id,{status:'IN_PROGRESS'})}>Mulai tugas</button>:task.status==='IN_PROGRESS'?<button className="primary full" onClick={()=>setComplete(true)}>Selesaikan tugas</button>:<div className="done-box"><b>Tugas selesai</b><p>{task.note}</p></div>}</article></main>
}

function Activity({tasks,role}:{tasks:Task[],role:Role}){return <main className="page"><div className="page-head"><div><p className="eyebrow">LINTAS DIVISI</p><h1>Aktivitas driver</h1><p>Pergerakan tugas IT, Purchasing, Accounting, dan GA.</p></div></div><section className="panel timeline">{[...tasks].sort((a,b)=>b.created-a.created).map(t=><div className="event" key={t.id}><span className={`event-dot ${t.status.toLowerCase()}`}/><div><div><b>{t.title}</b><Badge tone={t.status==='COMPLETED'?'green':t.status==='IN_PROGRESS'?'blue':'gray'}>{t.status.replace('_',' ')}</Badge></div><p>{t.division} · {t.requester}</p><small>{age(t.created)} lalu {role==='Driver'?'· Ditugaskan ke Risen Driver':''}</small></div></div>)}</section></main>}
function History({tasks,onOpen}:{tasks:Task[],onOpen:(t:Task)=>void}){const done=tasks.filter(t=>t.status==='COMPLETED');return <main className="page"><div className="page-head"><div><p className="eyebrow">ARSIP TUGAS</p><h1>Riwayat</h1><p>Daftar pekerjaan yang telah diselesaikan.</p></div></div><section className="panel"><div className="task-list">{done.length?done.map(t=><TaskRow key={t.id} task={t} onOpen={onOpen}/>):<div className="empty"><b>Belum ada riwayat</b><p>Tugas selesai akan tampil di sini.</p></div>}</div></section></main>}
function Admin({tasks}:{tasks:Task[]}){return <main className="page"><div className="page-head"><div><p className="eyebrow">ADMIN OVERVIEW</p><h1>Operasional TugasGo</h1><p>Ringkasan kerja lintas divisi hari ini.</p></div></div><section className="stats admin-stats"><div><small>TOTAL TUGAS</small><strong>{tasks.length}</strong><p>seluruh divisi</p></div><div><small>AKTIF</small><strong>{tasks.filter(t=>t.status!=='COMPLETED'&&t.status!=='CANCELLED').length}</strong><p>perlu tindak lanjut</p></div><div><small>SELESAI</small><strong>{tasks.filter(t=>t.status==='COMPLETED').length}</strong><p>tercatat</p></div><div><small>URGENT</small><strong>{tasks.filter(t=>t.priority==='URGENT'&&t.status!=='COMPLETED'&&t.status!=='CANCELLED').length}</strong><p>prioritas tinggi</p></div></section><section className="panel division-table"><div className="section-title"><div><h2>Divisi</h2><p>Distribusi tugas aktif</p></div></div>{['IT','Purchasing','Accounting','GA'].map(d=><div key={d}><b>{d}</b><span>{tasks.filter(t=>t.division===d&&t.status!=='COMPLETED'&&t.status!=='CANCELLED').length} aktif</span><div className="bar"><i style={{width:`${Math.max(8,tasks.filter(t=>t.division===d&&t.status!=='COMPLETED'&&t.status!=='CANCELLED').length*34)}%`}}/></div></div>)}</section></main>}

export default function App(){
 const [role,setRole]=useState<Role|null>(null); const [view,setView]=useState<View>('dashboard'); const [tasks,setTasks]=useState<Task[]>(seed); const [selected,setSelected]=useState<Task|null>(null); const [toast,setToast]=useState('')
 const open=(t:Task)=>{setSelected(t);setView('detail')}; const navigate=(v:View)=>{setSelected(null);setView(v)}
 const notify=(s:string)=>{setToast(s);setTimeout(()=>setToast(''),2400)}
 const update=(id:number,patch:Partial<Task>)=>{setTasks(ts=>ts.map(t=>t.id===id?{...t,...patch}:t));setSelected(s=>s?.id===id?{...s,...patch}:s);notify(patch.status==='COMPLETED'?'Tugas berhasil diselesaikan.':'Timer tugas dimulai.')}
 const create=(data:Omit<Task,'id'|'created'|'status'|'requester'>)=>{setTasks(t=>[{...data,id:Date.now(),created:Date.now(),status:'WAITING',requester:'Andi Purchasing'},...t]);navigate('dashboard');notify('Tugas baru berhasil dibuat.')}
 if(!role)return <Login onLogin={r=>{setRole(r);setView('dashboard')}}/>
 let screen:React.ReactNode
 if(view==='detail'&&selected)screen=<Detail task={selected} onBack={()=>navigate('dashboard')} onUpdate={update}/>
 else if(view==='activity')screen=<Activity tasks={tasks} role={role}/>
 else if(view==='history')screen=<History tasks={tasks} onOpen={open}/>
 else if(role==='Staff'&&view==='create')screen=<CreateTask onCreate={create} onCancel={()=>navigate('dashboard')}/>
 else if(role==='Staff')screen=<StaffDashboard tasks={tasks} onOpen={open} setView={navigate}/>
 else if(role==='Driver')screen=<DriverDashboard tasks={tasks} onOpen={open}/>
 else screen=<Admin tasks={tasks}/>
 return <Shell role={role} view={view} setView={navigate} logout={()=>setRole(null)}>{screen}{toast&&<div className="toast">✓ {toast}</div>}</Shell>
}
