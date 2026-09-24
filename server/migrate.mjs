import { readFile } from 'node:fs/promises'
import mysql from 'mysql2/promise'

if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL wajib')
const sql=await readFile(new URL('./schema.sql',import.meta.url),'utf8')
const connection=await mysql.createConnection({uri:process.env.DATABASE_URL,multipleStatements:true})
try{
  await connection.query(sql)
  const [columns]=await connection.query("SHOW COLUMNS FROM tasks LIKE 'guest_creator_name'")
  if(!columns.length)await connection.query('ALTER TABLE tasks ADD COLUMN guest_creator_name VARCHAR(120) NULL AFTER creator_id')
  const [availabilityColumns]=await connection.query("SHOW COLUMNS FROM users LIKE 'availability_status'")
  if(!availabilityColumns.length)await connection.query("ALTER TABLE users ADD COLUMN availability_status ENUM('AVAILABLE','ON_LEAVE','OFF_DUTY') NOT NULL DEFAULT 'AVAILABLE' AFTER active")
  else if(!availabilityColumns[0].Type.includes('OFF_DUTY'))await connection.query("ALTER TABLE users MODIFY COLUMN availability_status ENUM('AVAILABLE','ON_LEAVE','OFF_DUTY') NOT NULL DEFAULT 'AVAILABLE'")
  const [locationIndexes]=await connection.query("SHOW INDEX FROM driver_locations WHERE Key_name='idx_dloc_recorded'")
  if(!locationIndexes.length)await connection.query('ALTER TABLE driver_locations ADD INDEX idx_dloc_recorded(recorded_at)')
  console.log('Schema TugasGo siap')
}finally{await connection.end()}
