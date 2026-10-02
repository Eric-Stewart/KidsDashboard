import { z } from "zod";
const text=z.string().trim().min(1).max(2000);
const id=z.string().regex(/^[A-Za-z0-9:_-]{1,100}$/);
const number=z.number().finite().min(0).max(9999999);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
export const genesisImportSchema=z.object({
  extractedAt:z.string().datetime({offset:true}),schoolYear:z.string().regex(/^\d{4}-\d{4}$/),
  children:z.array(z.object({child:z.enum(["E","A"]),lunchBalance:z.number().finite().min(-9999999).max(9999999).optional(),
    courses:z.array(z.object({externalId:id,name:text,teacherName:text.nullable(),grades:z.array(z.object({period:z.string().regex(/^MP[1-4]$/),grade:z.string().max(50).nullable(),percentage:z.number().min(0).max(9999).nullable()}).strict()).max(4)}).strict()).min(1).max(100),
    assignments:z.array(z.object({externalId:id,courseId:id,title:text,category:z.string().max(200),dueDate:date.nullable(),status:z.enum(["UPCOMING","GRADED","MISSING","LATE","UNKNOWN"]),pointsEarned:number.nullable(),pointsPossible:number.nullable(),grade:z.number().min(0).max(9999).nullable(),currentGrade:z.string().max(100).nullable()}).strict()).max(3000),
  }).strict()).length(2),
}).strict().superRefine((v,c)=>{if(new Set(v.children.map(x=>x.child)).size!==2)c.addIssue({code:"custom",message:"Both children required"});for(const ch of v.children){const ids=new Set(ch.courses.map(x=>x.externalId));if(ids.size!==ch.courses.length||new Set(ch.assignments.map(x=>x.externalId)).size!==ch.assignments.length||ch.assignments.some(a=>!ids.has(a.courseId)))c.addIssue({code:"custom",message:"Invalid or duplicate identity"});}});
export type GenesisImport=z.infer<typeof genesisImportSchema>;
