import { mkdirSync,writeFileSync,existsSync,unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

if(process.platform!=='darwin')throw new Error('Run this installer on your iMac. No schedule was changed.');
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const label='local.kidsdashboard.collector';
const plist=join(homedir(),'Library','LaunchAgents',label+'.plist');
const domain=`gui/${process.getuid()}`;
const mode=process.argv[2];
if(!['install','remove'].includes(mode))throw new Error('Choose install or remove.');
if(mode==='remove'){
 spawnSync('/bin/launchctl',['bootout',`${domain}/${label}`],{stdio:'ignore'});
 if(existsSync(plist))unlinkSync(plist);
 console.log('Hourly refresh disabled. Manual refresh remains available.');
}else{
 const check=spawnSync(process.execPath,['--import','tsx','collector/run.ts','--check'],{cwd:root,stdio:'inherit'});
 if(check.status!==0)throw new Error('Complete local configuration before enabling the schedule.');
 const logs=join(homedir(),'Library','Logs','KidsDashboard');
 mkdirSync(dirname(plist),{recursive:true});mkdirSync(logs,{recursive:true,mode:0o700});
 const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const content=`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>--import</string><string>tsx</string><string>${xml(join(root,'collector','run.ts'))}</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>StartCalendarInterval</key><dict><key>Minute</key><integer>0</integer></dict>
<key>LimitLoadToSessionType</key><string>Aqua</string>
<key>ProcessType</key><string>Background</string>
<key>StandardOutPath</key><string>${xml(join(logs,'refresh.log'))}</string>
<key>StandardErrorPath</key><string>${xml(join(logs,'refresh-error.log'))}</string>
<key>Umask</key><integer>63</integer>
</dict></plist>`;
 writeFileSync(plist,content,{mode:0o600});
 spawnSync('/bin/launchctl',['bootout',`${domain}/${label}`],{stdio:'ignore'});
 const started=spawnSync('/bin/launchctl',['bootstrap',domain,plist],{stdio:'inherit'});
 if(started.status!==0)throw new Error('macOS could not enable the schedule. Manual refresh is still available.');
 console.log('Hourly refresh enabled at the top of each hour while you are logged into macOS.');
 console.log('Chrome opens during collection. Keep the iMac awake and connected.');
 console.log('Logs: '+logs);
}
