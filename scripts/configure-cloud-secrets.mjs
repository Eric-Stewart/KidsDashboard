import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const config=JSON.parse(readFileSync('.config','utf8'));
const values={SCHOOL_SYNC_MODE:'cloud',GENESIS_USERNAME:config.genesis.username,GENESIS_PASSWORD:config.genesis.password,GENESIS_STUDENT_E:config.genesis.studentIds.E,GENESIS_STUDENT_A:config.genesis.studentIds.A,CLASSROOM_E_USERNAME:config.classroom.E.username,CLASSROOM_E_PASSWORD:config.classroom.E.password,CLASSROOM_A_USERNAME:config.classroom.A.username,CLASSROOM_A_PASSWORD:config.classroom.A.password,SCHOOL_SYNC_KEY:randomBytes(32).toString('hex')};
// A separate machine credential can trigger cloud sync; ingestion keys cannot.
writeFileSync('.env.cloud-sync.local','SCHOOL_SYNC_KEY='+values.SCHOOL_SYNC_KEY+'\n',{mode:0o600,flag:'wx'});
for(const [name,value] of Object.entries(values)){
 if(!value)throw new Error('Missing required setting: '+name);
 const args=['--yes','vercel@62.1.0','env','add',name,'production','--sensitive','--yes'];
 const result=spawnSync('cmd.exe',['/d','/s','/c','npx '+args.join(' ')],{input:value,encoding:'utf8',windowsHide:true});
 if(result.status!==0){console.error('Could not add '+name+'. No secret value was printed.');process.exit(1);}
 console.log('Configured '+name);
}
