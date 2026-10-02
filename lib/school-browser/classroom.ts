import type { Page } from "playwright-core";
import type { Observation } from "../../classroom-extension/src/extractor";
import { browserImportSchema,mergeObserved,type BrowserCourse,type BrowserAssignment } from "../classroom-browser-schema";
import { CollectorError, type CollectorConfig } from "./config";
import { signIn } from "./login";
async function observe(page:Page,bundle:string):Promise<Observation>{
  if(new URL(page.url()).origin!=="https://classroom.google.com")throw new CollectorError("Classroom redirected away from the student's page; collection stopped.");
  // Injection is bundled local extraction code, not code obtained from the page.
  await page.evaluate(bundle);
  for(let attempt=0;attempt<3;attempt++){
    try{return await page.evaluate(()=> (window as unknown as {__kidsDashboardCollect:()=>Observation}).__kidsDashboardCollect());}
    catch{if(attempt<2)await page.waitForTimeout(1500);}
  }
  {throw new CollectorError("Classroom's visible account or page structure could not be recognized. No data was imported.");}
}
export async function collectClassroom(page:Page,config:CollectorConfig,child:"E"|"A",bundle:string, sink?: (body: unknown)=>Promise<unknown>){
  const credentials=config.classroom[child];
  await signIn(page,"classroom",credentials);
  console.log(`Classroom ${child}: sign-in verified; reading visible pages.`);
  const started=Date.now();const seen=new Set<string>();const queue:string[]=[];
  const courses=new Map<string,BrowserCourse>();const assignments=new Map<string,BrowserAssignment>();const warnings=new Set<string>();
  while(true){
    await page.waitForLoadState("domcontentloaded");await page.waitForTimeout(1000);
    const data=await observe(page,bundle);
    console.log(`Classroom ${child}: read page ${seen.size+1}, ${data.courses.length} courses and ${data.assignments.length} assignments visible.`);
    if(data.email!==credentials.username.trim().toLowerCase())throw new CollectorError(`The visible Google account does not match child ${child}. Nothing was imported.`);
    seen.add(page.url());data.warnings.forEach(v=>warnings.add(v));
    for(const c of data.courses)courses.set(c.externalCourseId,mergeObserved(courses.get(c.externalCourseId)||c,c));
    for(const a of data.assignments){const id=`${a.externalCourseId}/${a.externalAssignmentId}`;assignments.set(id,mergeObserved(assignments.get(id)||a,a));}
    for(const link of data.links)if(!seen.has(link)&&!queue.includes(link))queue.push(link);
    if(seen.size>=100||Date.now()-started>180000){warnings.add("Page/time limit reached; only visited pages were imported.");break;}
    const next=queue.shift();if(!next)break;
    const url=new URL(next);
    if(url.origin!=="https://classroom.google.com"||!/^\/(?:u\/\d+\/)?(?:c|w)\/[\w-]+(?:\/(?:a|sa)\/[\w-]+\/details|\/t\/all)?\/?$/.test(url.pathname))throw new CollectorError("An unexpected page link was rejected.");
    await page.goto(url.href,{waitUntil:"domcontentloaded",timeout:30000});
  }
  if((await observe(page,bundle)).email!==credentials.username.trim().toLowerCase())throw new CollectorError("Google account changed during collection. Nothing was imported.");
  const body=browserImportSchema.parse({child,courses:[...courses.values()],assignments:[...assignments.values()],extractedAt:new Date(started).toISOString()});
  if(sink){await sink(body);return;}
  let result:Response;
  try {result=await fetch(`${config.dashboard.url}/api/classroom/import`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.KIDS_DASHBOARD_INGEST_KEY}`},credentials:"omit",redirect:"error",signal:AbortSignal.timeout(80000),body:JSON.stringify(body)});}
  catch{throw new CollectorError("KidsDashboard is unavailable. Start the local app/database or check the configured HTTPS URL.");}
  if(!result.ok)throw new CollectorError(result.status===401?"The KidsDashboard ingestion key is invalid.":"KidsDashboard rejected the import. Check browser source mode and the database.");
  console.log(`Classroom ${child}: ${courses.size} courses, ${assignments.size} assignments imported from ${seen.size} pages.`);
  for(const warning of warnings)console.log(warning);
}
