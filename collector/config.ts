import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { config as loadEnv } from "dotenv";
import { apiOrigin } from "../classroom-extension/src/settings";
import { CollectorError } from "../lib/school-browser/config";
export { CollectorError } from "../lib/school-browser/config";
const credentials=z.object({username:z.string().max(320),password:z.string().max(1024)}).strict();
const schema=z.object({
  dashboard:z.object({url:z.string().transform(apiOrigin)}).strict(),
  classroom:z.object({E:credentials,A:credentials}).strict(),
  genesis:credentials.extend({studentIds:z.object({E:z.string().regex(/^\d*$/),A:z.string().regex(/^\d*$/)}).strict()}).strict(),
}).strict();
export type CollectorConfig=z.infer<typeof schema>;
export async function readConfig():Promise<CollectorConfig> {
  loadEnv({path:resolve(".env.local"),quiet:true});
  try{return schema.parse(JSON.parse(await readFile(resolve(".config"),"utf8")));}
  catch{throw new CollectorError("Create .config from .config.example and check its JSON format. Credential values are never printed.");}
}
export function requireCredentials(value:{username:string;password:string},label:string){
  if(!value.username.trim()||!value.password)throw new CollectorError(`Fill in ${label} username and password in the local .config file.`);
}
