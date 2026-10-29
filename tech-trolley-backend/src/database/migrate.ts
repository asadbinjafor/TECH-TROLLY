import { connect } from './database';
import { readdir,readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
export async function migrate(){const db=await connect();await db.transaction(async em=>{await em.query('SELECT pg_advisory_xact_lock(74819321)');await em.query('CREATE TABLE IF NOT EXISTS schema_migration(name text PRIMARY KEY,hash text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');const directory=join(__dirname,'../../migrations');for(const name of (await readdir(directory)).filter(s=>s.endsWith('.sql')).sort()){const sql=await readFile(join(directory,name),'utf8'),hash=createHash('sha256').update(sql).digest('hex');const [old]=await em.query('SELECT hash FROM schema_migration WHERE name=$1',[name]);if(old){if(old.hash!==hash)throw new Error('MIGRATION_CHECKSUM_MISMATCH');continue;}await em.query(sql);await em.query('INSERT INTO schema_migration(name,hash) VALUES($1,$2)',[name,hash]);console.log('Applied',name);}});}
if(require.main===module)migrate().then(()=>process.exit(0)).catch(()=>{console.error('Migration failed. Check database connectivity and schema compatibility.');process.exit(1)});
