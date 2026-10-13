import "server-only";
import type { PrismaClient,Prisma } from "@/generated/prisma/client";
import { genesisImportSchema } from "./genesis-browser-schema";
import { assignmentFingerprint } from "./history";
import { browserDate } from "./classroom-browser-schema";
const sourceUrl="https://parents.c3.genesisedu.net/leonia/parents";
export async function reconcileGenesisSnapshot(
 tx:Pick<Prisma.TransactionClient,"assignmentSource"|"course">,
 child:"E"|"A",
 schoolYear:string,
 assignmentExternalIds:string[],
 courseExternalIds:string[],
){
 const hiddenAssignments=await tx.assignmentSource.updateMany({where:{childId:child,source:"GENESIS",available:true,externalId:{notIn:assignmentExternalIds}},data:{available:false}});
 const hiddenCourses=await tx.course.updateMany({where:{childId:child,source:"GENESIS",schoolYear,active:true,externalId:{notIn:courseExternalIds}},data:{active:false}});
 return hiddenAssignments.count+hiddenCourses.count;
}
export async function importGenesisBrowser(db:PrismaClient,input:unknown){
 const body=genesisImportSchema.parse(input),extractedAt=new Date(body.extractedAt);
 if(Math.abs(Date.now()-extractedAt.getTime())>7*86400000||extractedAt.getTime()>Date.now()+300000)throw new Error("INVALID_EXTRACTION_TIME");
 return db.$transaction(async tx=>{
  const now=new Date();await tx.dataSource.upsert({where:{id:"genesis"},create:{id:"genesis",source:"GENESIS"},update:{lastAttemptAt:now}});
  await tx.dataSource.update({where:{id:"genesis"},data:{lastAttemptAt:now}});
  const previous=await tx.dataSource.findUniqueOrThrow({where:{id:"genesis"}});
  if(previous.lastSuccessAt&&previous.lastSuccessAt>=extractedAt)throw new Error("STALE_EXTRACTION");
  const run=await tx.syncRun.create({data:{dataSourceId:"genesis"}});let created=0,updated=0,snapshots=0,retrieved=0;
  for(const ch of body.children){
   const courses=new Map<string,string>();
   for(const c of ch.courses){
    const identity={childId:ch.child,source:"GENESIS" as const,externalId:c.externalId,schoolYear:body.schoolYear};
    const before=await tx.course.findUnique({where:{childId_source_externalId_schoolYear:identity}});
    const course=await tx.course.upsert({where:{childId_source_externalId_schoolYear:identity},create:{...identity,name:c.name,teacherName:c.teacherName,sourceUrl,lastExtractedAt:extractedAt},update:{name:c.name,teacherName:c.teacherName,lastExtractedAt:extractedAt,active:true}});
    courses.set(c.externalId,course.id);retrieved++;if(!before)created++;
    for(const g of c.grades){
     const where={courseId_period:{courseId:course.id,period:g.period}};
     const old=await tx.courseGrade.findUnique({where});
     if(old&&old.grade===g.grade&&(old.percentage===null?null:Number(old.percentage))===g.percentage)continue;
     const saved=await tx.courseGrade.upsert({where,create:{courseId:course.id,...g},update:g});
     await tx.courseGradeSnapshot.create({data:{courseGradeId:saved.id,grade:g.grade,percentage:g.percentage,syncRunId:run.id,observedAt:extractedAt}});snapshots++;
    }
   }
   for(const a of ch.assignments){
    const identity={childId:ch.child,source:"GENESIS" as const,externalId:`${body.schoolYear}/${a.courseId}/${a.externalId}`};
    const old=await tx.assignmentSource.findUnique({where:{childId_source_externalId:identity},include:{assignment:{include:{history:{orderBy:{observedAt:"desc"},take:1}}}}});
    const state={title:a.title,description:null,status:a.status,dueDate:browserDate(a.dueDate),dueDateOnly:!!a.dueDate,assignedDate:null,type:/test|quiz/i.test(a.category)?"TEST" as const:/project/i.test(a.category)?"PROJECT" as const:"ASSIGNMENT" as const,pointsEarned:a.pointsEarned,pointsPossible:a.pointsPossible,grade:a.grade,currentGrade:a.currentGrade,sourceState:a.status,sourceLate:a.status==="LATE"};
    const fingerprint=assignmentFingerprint(state);const {sourceState,sourceLate,...fields}=state;const values={...fields,dueDate:state.dueDate?new Date(state.dueDate):null};
    const changed=!old||old.assignment.history[0]?.fingerprint!==fingerprint;
    const assignment=old?.assignment||await tx.assignment.create({data:{...values,childId:ch.child,courseId:courses.get(a.courseId)!}});
    if(old&&changed){await tx.assignment.update({where:{id:assignment.id},data:values});updated++;}
    if(!old)created++;
    if(changed){await tx.assignmentHistory.create({data:{...values,sourceState,sourceLate,assignmentId:assignment.id,syncRunId:run.id,fingerprint,observedAt:extractedAt}});snapshots++;}
    const raw=JSON.parse(JSON.stringify(a)) as Prisma.InputJsonValue;
    const saved=await tx.assignmentSource.upsert({where:{childId_source_externalId:identity},create:{...identity,assignmentId:assignment.id,sourceUrl,raw,fingerprint,lastExtractedAt:extractedAt,lastSeenAt:now},update:{raw,fingerprint,lastExtractedAt:extractedAt,lastSeenAt:now,available:true}});
    if(old?.fingerprint!==fingerprint)await tx.sourceRevision.create({data:{assignmentSourceId:saved.id,raw,fingerprint,observedAt:extractedAt}});
    retrieved++;
   }
   updated+=await reconcileGenesisSnapshot(tx,ch.child,body.schoolYear,ch.assignments.map(a=>`${body.schoolYear}/${a.courseId}/${a.externalId}`),ch.courses.map(c=>c.externalId));
   if(ch.lunchBalance!==undefined){const old=await tx.lunchBalanceSnapshot.findFirst({where:{childId:ch.child},orderBy:{observedAt:"desc"}});if(!old||Number(old.balance)!==ch.lunchBalance){await tx.lunchBalanceSnapshot.create({data:{childId:ch.child,balance:ch.lunchBalance,syncRunId:run.id,observedAt:extractedAt}});snapshots++;}retrieved++;}
  }
  await tx.syncRun.update({where:{id:run.id},data:{status:"SUCCESS",finishedAt:new Date(),recordsRetrieved:retrieved,recordsCreated:created,recordsUpdated:updated,snapshotChanges:snapshots}});
  await tx.dataSource.update({where:{id:"genesis"},data:{lastSuccessAt:new Date()}});
  return {retrieved,created,updated,snapshots};
 },{timeout:90000,maxWait:10000});
}
