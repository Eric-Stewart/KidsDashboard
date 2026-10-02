import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
import pg from 'pg';
const local=parse(readFileSync('.env.local','utf8'));
const production=parse(readFileSync('.env.vercel.production.local','utf8'));
const target=production.DATABASE_URL_UNPOOLED||production.DATABASE_URL;
const url=new URL(target);
if(!url.hostname.endsWith('.neon.tech')||url.protocol!=='postgresql:'||new URL(local.DATABASE_URL).hostname!=='127.0.0.1')throw new Error('Expected local source and project Neon destination.');
const env={...process.env,DATABASE_URL:target,DIRECT_URL:target};
const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env,encoding:'utf8',windowsHide:true});
if(result.status!==0){console.error('Production migrations failed. No connection values were printed.');process.exit(1);}
console.log('Production migrations applied.');
if(process.argv.includes('--schema-only'))process.exit(0);
const tables=['Child','DataSource','Course','SyncRun','Assignment','AssignmentSource','SourceRevision','AssignmentHistory','CourseGrade','CourseGradeSnapshot','LunchBalanceSnapshot','ReconciliationDecision'];
const source=new pg.Client({connectionString:local.DATABASE_URL});const dest=new pg.Client({connectionString:target});
try{
 await source.connect();await dest.connect();
 await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await dest.query('BEGIN');
 for(const table of tables){const existing=await dest.query(`SELECT count(*)::int AS n FROM "${table}"`);if(existing.rows[0].n!==0)throw new Error('Destination already has records; no overwrite attempted.');}
 if((await source.query(`SELECT count(*)::int AS n FROM "SyncRun" WHERE status='RUNNING'`)).rows[0].n)throw new Error('Wait until local collection finishes.');
 for(const table of tables){
  const {rows}=await source.query(`SELECT * FROM "${table}"`);
  for(const row of rows){
   if(table==='DataSource'){row.leaseToken=null;row.leaseExpiresAt=null;}
   const keys=Object.keys(row);const columns=keys.map(k=>'"'+k.replaceAll('"','""')+'"').join(',');
   await dest.query(`INSERT INTO "${table}" (${columns}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>row[k]));
  }
  const count=(await dest.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n;
  if(count!==rows.length)throw new Error('Transfer count mismatch.');
  console.log(`${table}: ${count} records verified.`);
 }
 await dest.query('COMMIT');await source.query('COMMIT');console.log('School records and history copied. Local data preserved; OAuth credentials and session attempts were excluded.');
}catch(error){await dest.query('ROLLBACK').catch(()=>{});console.error('Transfer stopped; no partial transfer committed. '+(['Destination already has records; no overwrite attempted.','Wait until local collection finishes.','Transfer count mismatch.'].includes(error.message)?error.message:'Check connectivity and database schema.'));process.exitCode=1;}
finally{await source.end().catch(()=>{});await dest.end().catch(()=>{});}
