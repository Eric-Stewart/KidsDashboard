import type { Page } from "playwright-core";
import { CollectorError,type CollectorConfig } from "./config";
import { signIn } from "./login";
import { genesisImportSchema,type GenesisImport } from "../genesis-browser-schema";
const origin="https://parents.c3.genesisedu.net";
async function navigate(page:Page,url:string,id:string){
 const target=new URL(url);if(target.origin!==origin||target.pathname!=="/leonia/parents")throw new CollectorError("Unexpected Genesis link.");
 await page.goto(target.href,{waitUntil:"domcontentloaded",timeout:45000});
 const actual=new URL(page.url());if(actual.origin!==origin||actual.searchParams.get("studentid")!==id)throw new CollectorError("Genesis student navigation could not be verified. Nothing imported.");
 if(await page.locator('input[type="password"]:visible').count())throw new CollectorError("Genesis session expired. Nothing imported.");
}
export async function collectGenesis(page:Page,config:CollectorConfig,sink?: (body: unknown)=>Promise<unknown>){
 await signIn(page,"genesis",config.genesis,Object.values(config.genesis.studentIds));
 const extractedAt=new Date().toISOString();const now=new Date();const year=now.getMonth()>=7?now.getFullYear():now.getFullYear()-1;
 const children:GenesisImport["children"]=[];
 for(const child of ["E","A"] as const){
  const id=config.genesis.studentIds[child];
  // This exact route was supplied by the user and verified on both accounts.
  await navigate(page,`${origin}/leonia/parents?tab1=studentdata&tab2=gradebook&tab3=weeklysummary&action=form&studentid=${encodeURIComponent(id)}`,id);
  const nav=await page.locator("a[href]").evaluateAll(nodes=>nodes.map(n=>(n as HTMLAnchorElement).href));
  const find=(key:string,value:string)=>nav.find(link=>{const u=new URL(link);return u.origin===locationOrigin&&u.searchParams.get(key)===value;});
  const locationOrigin=origin;
  const summary=find("tab2","studentsummary"),assignmentsLink=find("tab3","listassignments");
  if(!summary||!assignmentsLink)throw new CollectorError("Genesis navigation changed; no data imported.");
  const gradeBlocks=await page.locator("table").evaluateAll(nodes=>nodes.filter(t=>/^MP[1-4]/.test((t as HTMLElement).innerText.trim())).map(t=>({label:(t.parentElement?.parentElement as HTMLElement)?.innerText.split(/MP[1-4]/)[0].trim(),rows:[...(t as HTMLTableElement).rows].map(r=>[...r.cells].map(c=>c.innerText.trim()))})));
  await navigate(page,summary,id);
  // Read only the labeled balance row, never the surrounding personal-information table.
  const balances=await page.locator("tr").evaluateAll(rows=>rows.map(r=>r as HTMLTableRowElement).filter(r=>r.cells.length>=2&&/^Lunch Balance:?$/.test(r.cells[0].innerText.trim())).map(r=>r.cells[1].innerText.trim()));
  if(balances.length!==1||!/^\(?-?\$?[\d,]+\.\d{2}\)?$/.test(balances[0]))throw new CollectorError(`Genesis ${child}: lunch balance structure changed. Nothing imported.`);
  const lunchBalance=Number(balances[0].replace(/[$,()]/g,""))*(balances[0].includes("(")?-1:1);
  await navigate(page,assignmentsLink,id);
  for(const [name,value] of [["fldDateRange","allMP"],["fldCourse",""],["fldStatus",""]]){
   const select=page.locator(`select[name="${name}"]`);if(await select.count()!==1)throw new CollectorError("Genesis assignment filters changed.");
   if(await select.inputValue()!==value){await select.selectOption(value);await page.waitForTimeout(750);await page.waitForLoadState("domcontentloaded");}
  }
  const observed=await page.evaluate(()=>{
   const select=document.querySelector<HTMLSelectElement>('select[name="fldCourse"]');
   const courses=[...(select?.options||[])].filter(o=>o.value).map(o=>({externalId:o.value,name:o.text.trim()}));
   const tables=[...document.querySelectorAll("table")].filter(t=>t.rows[0]&&[...t.rows[0].cells].slice(0,4).map(c=>c.innerText.trim()).join("|")==="Due|Course|Assignment|Grade");
   if(tables.length!==1)throw new Error("Unrecognized assignment table");
   const rows=[...tables[0].rows].slice(1).filter(r=>r.getClientRects().length>0&&r.cells.length>=4).map(r=>({id:r.querySelector('[id^="divDescription"]')?.id.replace(/^divDescription/,""),cells:[...r.cells].slice(0,4).map(c=>c.innerText.trim())}));
   return {courses,rows};
  });
  const courses:GenesisImport["children"][number]["courses"]=observed.courses.map(c=>{
   const matches=gradeBlocks.filter(b=>b.label?.split("\n")[0].replace(/^(FY|S[12]|Q[1-4])\s*\|\s*/,"").trim()===c.name);
   if(matches.length!==1)throw new CollectorError("Genesis course summary does not match its course selector.");
   const block=matches[0];const grades:GenesisImport["children"][number]["courses"][number]["grades"]=[];
   for(let i=0;i<(block.rows[0]?.length||0);i++){
    const period=block.rows[0][i].match(/^MP[1-4]/)?.[0];if(!period)continue;
    const raw=block.rows[1]?.[i]||"";const m=raw.match(/^(\d+(?:\.\d+)?)\s*\(([^)]+)\)$/);
    if(raw!=="---"&&!m)throw new CollectorError("Genesis course grade format changed.");
    grades.push({period,grade:m?.[2]||null,percentage:m?Number(m[1]):null});
   }
   return {...c,teacherName:block.label?.split("\n").slice(1).join(" ").trim()||null,grades};
  });
  const assignments:GenesisImport["children"][number]["assignments"]=observed.rows.map(r=>{
   if(!r.id||!/^\d+$/.test(r.id))throw new CollectorError("Genesis assignment has no stable rendered identifier.");
   const [due,course,assignment,score]=r.cells;const name=course.split("\n")[0].trim();const matches=courses.filter(c=>c.name===name);
   if(matches.length!==1)throw new CollectorError("Genesis assignment course is ambiguous.");
   const md=due.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);let dueDate:string|null=null;
   if(md){const month=Number(md[1]),day=Number(md[2]),y=md[3]?(md[3].length===2?2000+Number(md[3]):Number(md[3])):(month>=8?year:year+1);dueDate=`${y}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;}
   const lines=assignment.split("\n").map(x=>x.trim()).filter(Boolean);const category=lines.shift()||"";const title=lines.join("\n");if(!title)throw new CollectorError("Genesis assignment title missing.");
   const fraction=score.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/),pct=score.match(/(\d+(?:\.\d+)?)%/),possible=score.match(/Assignment Pts:\s*(\d+(?:\.\d+)?)/);
   const status=/\bMissing\b/i.test(score)?"MISSING":/\bLate\b/i.test(score)?"LATE":fraction||pct?"GRADED":/No Grade/i.test(score)?"UPCOMING":"UNKNOWN";
   return {externalId:r.id,courseId:matches[0].externalId,title,category,dueDate,status,pointsEarned:fraction?Number(fraction[1]):null,pointsPossible:fraction?Number(fraction[2]):possible?Number(possible[1]):null,grade:pct?Number(pct[1]):null,currentGrade:fraction?`${fraction[1]} / ${fraction[2]}`:pct?score.split("\n")[0]:null};
  });
  children.push({child,courses,assignments,lunchBalance});console.log(`Genesis ${child}: ${courses.length} courses, ${assignments.length} assignments, lunch balance read.`);
 }
 const payload=genesisImportSchema.parse({extractedAt,schoolYear:`${year}-${year+1}`,children});
 if(sink){await sink(payload);return;}
 let response:Response;try{response=await fetch(`${config.dashboard.url}/api/genesis/import`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${process.env.KIDS_DASHBOARD_INGEST_KEY}`},credentials:"omit",redirect:"error",signal:AbortSignal.timeout(100000),body:JSON.stringify(payload)});}catch{throw new CollectorError("KidsDashboard is unavailable; Genesis data was not saved.");}
 if(!response.ok)throw new CollectorError(response.status===401?"Invalid KidsDashboard ingestion key.":`KidsDashboard rejected the Genesis import (HTTP ${response.status}); previous data preserved.`);
 console.log("Genesis: both children's grades, assignments and lunch balances imported successfully.");
}
