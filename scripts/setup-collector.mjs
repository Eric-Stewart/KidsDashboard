import { copyFile,access,chmod } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { resolve } from "node:path";
const path=resolve(".config");
try{await access(path);console.log("Existing .config preserved.");}catch{await copyFile(resolve(".config.example"),path,constants.COPYFILE_EXCL);console.log("Created .config with blank school credentials.");}
if(process.platform==="win32"){
  // Restrict this single file to the current Windows account and SYSTEM.
  const identity=spawnSync("whoami.exe",["/user","/fo","csv","/nh"],{encoding:"utf8",windowsHide:true});
  const sid=identity.stdout?.match(/S-1-5-[\d-]+/)?.[0];
  if(!sid)throw new Error("Could not identify the Windows account for config permissions.");
  const acl=spawnSync("icacls.exe",[path,"/inheritance:r","/grant:r",`*${sid}:(F)`,"*S-1-5-18:(F)"],{encoding:"utf8",windowsHide:true});
  if(acl.status!==0)throw new Error("Could not restrict .config file permissions. Review the file's Windows security settings.");
}else await chmod(path,0o600);
console.log("Private config permissions applied. Enter credentials in .config locally, not in chat.");
