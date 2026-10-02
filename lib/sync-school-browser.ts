import "server-only";
import chromium from "@sparticuz/chromium";
import { chromium as playwright, type Browser } from "playwright-core";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { collectGenesis } from "./school-browser/genesis";
import { collectClassroom } from "./school-browser/classroom";
import { CollectorError, type CollectorConfig } from "./school-browser/config";
import { importGenesisBrowser } from "./import-genesis-browser";
import { importClassroomBrowser } from "./import-classroom-browser";

export async function syncSchoolBrowser(source: string) {
 const child=source==="google/e"?"E":"A";
 const genesis=source==="genesis";
 const id=genesis?"genesis":`google-browser-${child.toLowerCase()}`;
 const config:CollectorConfig={dashboard:{url:""},genesis:{username:process.env.GENESIS_USERNAME||"",password:process.env.GENESIS_PASSWORD||"",studentIds:{E:process.env.GENESIS_STUDENT_E||"",A:process.env.GENESIS_STUDENT_A||""}},classroom:{E:{username:process.env.CLASSROOM_E_USERNAME||"",password:process.env.CLASSROOM_E_PASSWORD||""},A:{username:process.env.CLASSROOM_A_USERNAME||"",password:process.env.CLASSROOM_A_PASSWORD||""}}};
 const credentials=genesis?config.genesis:config.classroom[child];
 if(!credentials.username||!credentials.password||(genesis&&Object.values(config.genesis.studentIds).some(v=>!/^\d+$/.test(v))))return {source,ok:false,message:"School login settings are missing on the server."};
 const db=getDb(),token=randomUUID(),now=new Date();
 await db.dataSource.upsert({where:{id},create:{id,source:genesis?"GENESIS":"GOOGLE_CLASSROOM_BROWSER",childId:genesis?null:child},update:{}});
 const lease=await db.dataSource.updateMany({where:{id,AND:[{OR:[{leaseExpiresAt:null},{leaseExpiresAt:{lt:now}}]},{OR:[{lastAttemptAt:null},{lastAttemptAt:{lt:new Date(Date.now()-60000)}}]}]},data:{leaseToken:token,leaseExpiresAt:new Date(Date.now()+290000),lastAttemptAt:now}});
 if(!lease.count)return {source,ok:false,message:"A refresh is running or just finished. Please wait a minute before trying again."};
 let browser:Browser|undefined;let expired=false;let stage="launch";
 const timer=setTimeout(()=>{expired=true;void browser?.close().catch(()=>{});},250000);
 try{
  browser=await playwright.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(v=>!['--disable-web-security','--allow-running-insecure-content','--disable-site-isolation-trials'].includes(v)),headless:true,timeout:45000});
  if(expired)throw new Error("timeout");
  stage="context";
  const context=await browser.newContext({locale:"en-US",timezoneId:"America/New_York",acceptDownloads:false});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  stage="school";
  if(genesis)await collectGenesis(page,config,body=>importGenesisBrowser(db,body));
  else await collectClassroom(page,config,child,await readFile(process.cwd()+"/generated/classroom-extractor.js","utf8"),body=>importClassroomBrowser(db,body));
  return {source,ok:true,message:genesis?"Genesis grades, assignments and lunch balances refreshed.":"Visible Classroom work refreshed. Collapsed or unvisited work may require an extension sync."};
 }catch(error){
  const detail=error instanceof Error?error.message:"";
  console.info("Cloud refresh outcome",{source,stage,timeout:expired||/Timeout/i.test(detail),browserClosed:/browser has been closed|Target closed/i.test(detail),networkCode:detail.match(/net::[A-Z_]+/)?.[0]||null,missingRuntime:/ENOENT|Cannot find|Executable doesn't exist/i.test(detail)});
  await db.syncRun.create({data:{dataSourceId:id,status:"FAILED",finishedAt:new Date(),errorCode:"BROWSER_SYNC_FAILED"}}).catch(()=>{});
  return {source,ok:false,message:expired?"School refresh timed out. Previous data is preserved.":error instanceof CollectorError?error.message:"The cloud browser could not complete the refresh. Previous data is preserved."};
 }finally{clearTimeout(timer);await browser?.close().catch(()=>{});await db.dataSource.updateMany({where:{id,leaseToken:token},data:{leaseToken:null,leaseExpiresAt:null}});}
}
