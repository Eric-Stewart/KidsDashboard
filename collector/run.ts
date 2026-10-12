import { chromium } from "playwright";
import { build } from "esbuild";
import { open,unlink } from "node:fs/promises";
import { readConfig,requireCredentials,CollectorError } from "./config";
import { collectClassroom } from "./classroom";
import { collectGenesis } from "./genesis";
async function main(){
  const args=process.argv.slice(2);const check=args.includes("--check");
  const source=args.find(v=>["all","classroom","genesis"].includes(v))||"all";
  const child=args.includes("--child")?args[args.indexOf("--child")+1]:undefined;
  if(child&&!['E','A'].includes(child))throw new CollectorError("Use --child E or --child A.");
  const config=await readConfig();
  const jobs:Array<{label:string;run:(page:import("playwright").Page,bundle:string)=>Promise<void>}> = [];
  const missing:string[]=[];
if(!process.env.KIDS_DASHBOARD_INGEST_KEY||process.env.KIDS_DASHBOARD_INGEST_KEY.length<32)missing.push("Set KIDS_DASHBOARD_INGEST_KEY in .env.local.");
  if(source!=="genesis"){
    if(process.env.CLASSROOM_SOURCE==="api")missing.push("Set CLASSROOM_SOURCE=browser for local collection.");
    for(const id of child?[child as "E"|"A"]:["E","A"] as const){
      try{requireCredentials(config.classroom[id],`Classroom ${id}`);if(!/^\S+@\S+\.\S+$/.test(config.classroom[id].username))throw new CollectorError(`Classroom ${id} username must be the full school Google email.`);jobs.push({label:`Classroom ${id}`,run:(page,bundle)=>collectClassroom(page,config,id,bundle)});}
      catch(error){missing.push((error as CollectorError).message);}
    }
  }
  if(source!=="classroom"){
    try{requireCredentials(config.genesis,"Genesis parent");if(!config.genesis.studentIds.E||!config.genesis.studentIds.A||config.genesis.studentIds.E===config.genesis.studentIds.A)throw new CollectorError("Set both distinct Genesis student IDs in .config.");jobs.push({label:"Genesis",run:(page)=>collectGenesis(page,config)});}
    catch(error){missing.push((error as CollectorError).message);}
  }
  for(const message of missing)console.log(message);
  if(check){console.log(`${jobs.length} account job(s) configured. No login attempted.`);if(missing.length)process.exitCode=1;return;}
  if(missing.length)throw new CollectorError("Fill the missing local configuration above, or run only a configured source/child. No login attempted.");
  let lock;
  try{lock=await open(".collector.lock","wx",0o600);}catch{throw new CollectorError("Another collector may be running (.collector.lock). If a previous run crashed, remove that lock only after confirming it has stopped.");}
  try{
    const output=await build({entryPoints:["collector/page-entry.ts"],bundle:true,write:false,platform:"browser",target:"chrome114",format:"iife",logLevel:"silent"});
    const bundle=output.outputFiles[0].text;
    let browser;
    try{browser=await chromium.launch({channel:"chrome",headless:false});}
    catch{throw new CollectorError(`Chrome could not open a visible window (DISPLAY=${process.env.DISPLAY??"(unset)"}). Keep this computer logged in with Google Chrome installed, then run manual refresh.`);}
    try{
      for(const job of jobs){
        // Separate ephemeral contexts ensure neither child's account leaks into the other's run.
        const context=await browser.newContext({locale:"en-US",timezoneId:"America/New_York",acceptDownloads:false});
        try{console.log(`${job.label}: opening normal sign-in.`);await job.run(await context.newPage(),bundle);}
        catch(error){console.log(`${job.label}: ${error instanceof CollectorError?error.message:"Collection stopped unexpectedly. No diagnostic containing credentials or page data was printed."}`);process.exitCode=1;}
        finally{await context.close();}
      }
    }finally{await browser.close();}
  }finally{await lock.close();await unlink(".collector.lock").catch(()=>{});}
}
main().catch(error=>{console.error(error instanceof CollectorError?error.message:"Collector could not start. Check Chrome installation and local configuration. No credentials were printed.");process.exitCode=1;});
