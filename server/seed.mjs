import mysql from 'mysql2/promise'
import { hashPassword } from './domain.mjs'

if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL wajib')
for(const key of ['SEED_ADMIN_PASSWORD','SEED_STAFF_PASSWORD','SEED_DRIVER_PASSWORD'])if(!process.env[key])throw new Error(`${key} wajib`)
const db=await mysql.createConnection(process.env.DATABASE_URL)
try{
  for(const name of ['IT','Purchasing','Accounting','GA'])await db.execute('INSERT INTO divisions(name) VALUES(?) ON DUPLICATE KEY UPDATE active=TRUE',[name])
  const [divisions]=await db.query('SELECT id,name FROM divisions');const division=Object.fromEntries(divisions.map(d=>[d.name,d.id]))
  const users=[['Admin','admin',process.env.SEED_ADMIN_PASSWORD,'ADMIN',null],['Andi Purchasing','andi',process.env.SEED_STAFF_PASSWORD,'STAFF',division.Purchasing],['Budi Accounting','budi',process.env.SEED_STAFF_PASSWORD,'STAFF',division.Accounting],['Risen Driver','risen',process.env.SEED_DRIVER_PASSWORD,'DRIVER',null]]
  for(const [name,username,password,role,divisionId] of users){const digest=await hashPassword(password);await db.execute('INSERT INTO users(name,username,password_hash,role,division_id) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),password_hash=VALUES(password_hash),role=VALUES(role),division_id=VALUES(division_id),active=TRUE',[name,username,digest,role,divisionId])}
  const [[staff]]=await db.execute("SELECT id FROM users WHERE username='andi'");const [[driver]]=await db.execute("SELECT id FROM users WHERE username='risen'");const [[count]]=await db.query('SELECT COUNT(*) total FROM tasks')
  if(!Number(count.total)){
    await db.execute("INSERT INTO tasks(title,description,priority,creator_id,division_id,assignee_id,location_name,address) VALUES('Beli Kabel LAN','Beli kabel LAN Cat6 sepanjang 50 meter untuk ruang meeting lantai 2.','NORMAL',?,?,?,?,?)",[staff.id,division.Purchasing,driver.id,'Toko Sumber Network','Jl. Ngagel 88, Surabaya'])
    await db.execute("INSERT INTO tasks(title,description,priority,creator_id,division_id,assignee_id,location_name,address) VALUES('Antar Dokumen Kontrak','Antarkan map kontrak bertanda merah. Serahkan langsung kepada Ibu Ratna.','URGENT',?,?,?,?,?)",[staff.id,division.Purchasing,driver.id,'Kantor Notaris Graha Pena','Jl. Ahmad Yani 88, Surabaya'])
  }
  console.log('Seed TugasGo siap')
}finally{await db.end()}
