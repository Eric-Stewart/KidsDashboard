import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Linux counterpart to scripts/macos-schedule.mjs (which only runs on macOS).
// Registers the same hourly job — node --import tsx collector/run.ts at
// minute 0 — as a per-user cron entry instead of a LaunchAgent plist.
export const label='local.kidsdashboard.collector';
export const cronSchedule='0 * * * *';
export const root=dirname(dirname(fileURLToPath(import.meta.url)));

export function shellQuote(s){
  return `'${s.replaceAll(`'`, `'"'"'`)}'`;
}
export function cronEntry({rootDir,nodeExe,logs,display}){
  const job=`cd ${shellQuote(rootDir)} && ${shellQuote(nodeExe)} --import tsx collector/run.ts >> ${shellQuote(join(logs,'refresh.log'))} 2>> ${shellQuote(join(logs,'refresh-error.log'))}`;
  // A bare `DISPLAY=... cd ...` prefix only applies to `cd`, leaving node
  // without a display, so headed Chrome cannot start. Export instead so the
  // variable survives the `&&` chain into the collector.
  const env=display?`export DISPLAY=${shellQuote(display)}; `:'';
  return `${cronSchedule} ${env}${job} # ${label}`;
}
export function upsertCronEntry(existing,entry,marker){
  const kept=existing.split('\n').filter(line=>line.trim()!==''&&!line.includes(marker));
  kept.push(entry);
  return kept.join('\n')+'\n';
}
export function removeCronEntries(existing,marker){
  const kept=existing.split('\n').filter(line=>line.trim()!==''&&!line.includes(marker));
  return kept.length?kept.join('\n')+'\n':'';
}
export function readCrontab(){
  const listed=spawnSync('crontab',['-l'],{encoding:'utf8'});
  if(listed.status!==0)return '';
  return listed.stdout ?? '';
}
export function writeCrontab(content){
  if(!content){
    const removed=spawnSync('crontab',['-r'],{stdio:'inherit'});
    if(removed.status!==0)throw new Error('Could not remove the schedule. Manual refresh is still available.');
    return;
  }
  const written=spawnSync('crontab',['-'],{input:content,encoding:'utf8',stdio:['pipe','inherit','inherit']});
  if(written.status!==0)throw new Error('The schedule could not be saved. Manual refresh is still available.');
}
export function cronRunning(){
  return spawnSync('pgrep',['-x','cron'],{stdio:'ignore'}).status===0;
}

function install(){
  const check=spawnSync(process.execPath,['--import','tsx','collector/run.ts','--check'],{cwd:root,stdio:'inherit'});
  if(check.status!==0)throw new Error('Complete local configuration before enabling the schedule.');
  const logs=join(homedir(),'.local','share','KidsDashboard','logs');
  mkdirSync(logs,{recursive:true,mode:0o700});
  const entry=cronEntry({rootDir:root,nodeExe:process.execPath,logs,display:process.env.DISPLAY||':0'});
  writeCrontab(upsertCronEntry(readCrontab(),entry,label));
  console.log('Scheduled hourly refresh enabled at the top of every hour.');
  console.log('Chrome opens during collection. Keep this computer awake, logged in, and connected.');
  console.log('Logs: '+logs);
  console.log('Verify with: crontab -l');
  if(!cronRunning())console.log('Warning: the cron daemon does not appear to be running, so hourly runs will not fire until it starts (sudo service cron start).');
}

function remove(){
  const before=readCrontab();
  const remaining=removeCronEntries(before,label);
  if(remaining===before&&before!=='')console.log('No scheduled refresh was found. Manual refresh remains available.');
  else{
    writeCrontab(remaining);
    console.log('Scheduled refresh disabled. Manual refresh remains available.');
  }
}

function main(){
  const mode=process.argv[2];
  if(!['install','remove'].includes(mode))throw new Error('Choose install or remove.');
  if(mode==='remove')remove();
  else install();
}

if(process.argv[1]===fileURLToPath(import.meta.url))main();
