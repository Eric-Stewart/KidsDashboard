import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {parse} from 'dotenv';
const local=parse(readFileSync('.env.local','utf8'));
const values={AUTH_SECRET:local.AUTH_SECRET,AUTH_GOOGLE_ID:local.AUTH_GOOGLE_ID,AUTH_GOOGLE_SECRET:local.AUTH_GOOGLE_SECRET,PARENT_EMAILS:local.PARENT_EMAILS,KIDS_DASHBOARD_INGEST_KEY:local.KIDS_DASHBOARD_INGEST_KEY,AUTH_URL:'https://kidsdashboard-eight.vercel.app',CLASSROOM_SOURCE:'browser',DEMO_MODE:'false'};
for(const [name,value] of Object.entries(values)){
 if(!value)throw new Error('Missing required setting: '+name);
 const args=['--yes','vercel@62.1.0','env','add',name,'production','--sensitive','--yes'];
 const result=process.platform==='win32'?spawnSync('cmd.exe',['/d','/s','/c','npx '+args.join(' ')],{input:value,encoding:'utf8',windowsHide:true}):spawnSync('npx',args,{input:value,encoding:'utf8'});
 if(result.status!==0){console.error('Could not add '+name+'. No secret value was printed.');process.exit(1);}
 console.log('Configured '+name);
}
