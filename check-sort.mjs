import { readFileSync } from 'node:fs'

const sort = tasks => [...tasks].filter(t=>!['COMPLETED','CANCELLED'].includes(t.status)).sort((a,b)=>{const rank=t=>t.status==='IN_PROGRESS'?0:t.priority==='URGENT'?1:2;return rank(a)-rank(b)||a.created-b.created})
const input=[{id:'normal-new',status:'WAITING',priority:'NORMAL',created:4},{id:'urgent-new',status:'WAITING',priority:'URGENT',created:3},{id:'completed',status:'COMPLETED',priority:'URGENT',created:0},{id:'cancelled',status:'CANCELLED',priority:'URGENT',created:0},{id:'active',status:'IN_PROGRESS',priority:'NORMAL',created:5},{id:'urgent-old',status:'WAITING',priority:'URGENT',created:1},{id:'normal-old',status:'WAITING',priority:'NORMAL',created:2}]
const actual=sort(input).map(t=>t.id).join(',')
const expected='active,urgent-old,urgent-new,normal-old,normal-new'
if(actual!==expected)throw new Error(`Sorting salah: ${actual}`)

const source=readFileSync(new URL('./src/App.tsx',import.meta.url),'utf8')
if(/\b(?:OPEN|DONE)\b/.test(source))throw new Error('Status lama masih ditemukan')
for(const status of ['WAITING','IN_PROGRESS','COMPLETED','CANCELLED'])if(!source.includes(`'${status}'`))throw new Error(`Status ${status} belum tersedia`)
if(!source.includes('Sudah ${waitingAge(task.created)} belum dikerjakan'))throw new Error('Narasi umur WAITING belum sesuai')
for(const asset of ['/image/logo.png','/image/logo1.png','/image/logo-real.png'])if(!source.includes(`'${asset}'`))throw new Error(`Brand asset ${asset} belum dipakai`)

const css=readFileSync(new URL('./src/App.css',import.meta.url),'utf8')
if(!css.includes('.event-dot.completed'))throw new Error('Status COMPLETED belum memakai style timeline yang benar')

const html=readFileSync(new URL('./index.html',import.meta.url),'utf8')
if(!html.includes('href="/image/logo1.png"'))throw new Error('Favicon asli belum dipakai')

console.log(`PASS status, sorting, branding, dan timeline: ${actual}`)
