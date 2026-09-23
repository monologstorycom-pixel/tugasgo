import { readFile } from 'node:fs/promises'
import mysql from 'mysql2/promise'

if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL wajib')
const sql=await readFile(new URL('./schema.sql',import.meta.url),'utf8')
const connection=await mysql.createConnection({uri:process.env.DATABASE_URL,multipleStatements:true})
try{await connection.query(sql);console.log('Schema TugasGo siap')}finally{await connection.end()}
