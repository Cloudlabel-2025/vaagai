import nextEnv from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readSource, inspectFiles, importTables } from "./migration-core.mjs";
import { getMongoDatabase, closeMongo } from "../db/mongodb.mjs";
nextEnv.loadEnvConfig(process.cwd());
const args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const allowed=new Set(["--source","--uploads","--apply","--dry-run"]);
for(let i=0;i<args.length;i++){if(!allowed.has(args[i]))throw Error("Unknown migration argument");if(["--source","--uploads"].includes(args[i]))i++;}
const source=path.resolve(option("--source","data/jaguar.sqlite"));
const uploads=path.resolve(option("--uploads","data/uploads"));
const apply=args.includes("--apply")&&!args.includes("--dry-run");
const directory=path.resolve("data/migration",new Date().toISOString().replace(/[:.]/g,"-"));
try{
 await mkdir(directory,{recursive:true});
 const tables=await readSource(source,directory),files=await inspectFiles(tables,uploads);
 const inventory={source,counts:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length])),files:files.map(({filename,...rest})=>rest)};
 await writeFile(path.join(directory,"records.json"),JSON.stringify(tables,null,2));
 await writeFile(path.join(directory,"manifest.json"),JSON.stringify(inventory,null,2));
 console.log(JSON.stringify({mode:apply?"apply":"dry-run",...inventory},null,2));
 if(apply){
  const report=await importTables(await getMongoDatabase(),tables,files);
  await writeFile(path.join(directory,"verified-report.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
 }else console.log("Source checked and backed up. No MongoDB records written. Use --apply after reviewing counts.");
}catch(error){
 // Connection errors can contain credentials or host names; avoid logging raw driver messages.
 console.error("Migration stopped:",error?.name==="Error"?error.message:error?.name||"unknown error");process.exitCode=1;
}finally{await closeMongo();}
