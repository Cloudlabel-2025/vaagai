import { DatabaseSync, backup } from "node:sqlite";
import { readFile, mkdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { BSON, GridFSBucket } from "mongodb";
import { applicationCollections } from "../db/collections.mjs";

const required = {
 crew_records:["id","kind","author","data","created_at","updated_at","revision"],
 guide_usage:["id","author","day","used"],
 growth_workspace:["id","data","revision","updated_by","updated_at"],
 c310_models:["id","data","created_at"],
 c310_assessments:["id","rider","data","revision","created_at","updated_at"]
};
export function canonical(value) {
 if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
 if(value && typeof value==="object")return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}";
 return JSON.stringify(value);
}
export async function fileHash(filename) {
 const hash=createHash("sha256");for await(const chunk of createReadStream(filename))hash.update(chunk);return hash.digest("hex");
}
export function normalizeTables(tables) {
 const result={};
 for(const table of applicationCollections){
  if(!Array.isArray(tables[table]))throw Error("Missing complete table: "+table);
  const ids=new Set();
  result[table]=tables[table].map(row=>{
   for(const field of required[table])if(row[field]===undefined||row[field]===null)throw Error("Missing field "+table+"."+field);
   if(typeof row.id!=="string"||!row.id||ids.has(row.id))throw Error("Invalid or duplicate ID in "+table);
   ids.add(row.id);
   const doc=Object.fromEntries(required[table].map(k=>[k,row[k]]));
   doc._id=doc.id;
   if("data" in doc){
    if(typeof doc.data==="string")doc.data=JSON.parse(doc.data);
    if(!doc.data||typeof doc.data!=="object"||Array.isArray(doc.data))throw Error("Invalid JSON data in "+table);
   }
   for(const field of required[table].filter(f=>!["data","revision","used"].includes(f)))if(typeof doc[field]!=="string")throw Error("Invalid text field in "+table);
   if("revision" in doc&&(!Number.isInteger(doc.revision)||doc.revision<1))throw Error("Invalid revision");
   if("used" in doc&&(!Number.isInteger(doc.used)||doc.used<0))throw Error("Invalid guide usage");
   if(BSON.calculateObjectSize(doc)>16*1024*1024)throw Error("Document exceeds MongoDB limit in "+table);
   return doc;
  });
 }
 return result;
}
export async function readSource(filename, backupDirectory) {
 if(path.extname(filename).toLowerCase()===".json")return normalizeTables(JSON.parse(await readFile(filename,"utf8")));
 const sqlite=new DatabaseSync(filename,{readOnly:true});
 try{
  if(backupDirectory){await mkdir(backupDirectory,{recursive:true});await backup(sqlite,path.join(backupDirectory,"source.sqlite"));}
  sqlite.exec("BEGIN");
  const tables=Object.fromEntries(applicationCollections.map(name=>[name,sqlite.prepare('SELECT * FROM "'+name+'"').all()]));
  sqlite.exec("COMMIT");
  return normalizeTables(tables);
 }finally{sqlite.close();}
}
export async function inspectFiles(tables, uploadsDirectory) {
 const files=[];
 for(const doc of tables.crew_records.filter(r=>r.kind==="upload")){
  const {key,size,type}=doc.data;
  if(typeof key!=="string"||!/^jaguar\/[a-f0-9-]{36}$/.test(key))throw Error("Invalid upload storage key");
  let filename=path.resolve(uploadsDirectory,...key.split("/"));const root=path.resolve(uploadsDirectory)+path.sep;
  try{await stat(filename);}catch(error){if(error.code!=="ENOENT")throw error;filename=path.resolve(uploadsDirectory,key.slice(7));}
  if(!filename.startsWith(root))throw Error("Upload outside source directory");
  const info=await stat(filename);
  if(!info.isFile()||info.size!==size)throw Error("Missing or incorrect upload size: "+doc.id);
  files.push({key,filename,size,contentType:type||"application/octet-stream",sha256:await fileHash(filename)});
 }
 return files;
}
async function gridHash(bucket,id) {const hash=createHash("sha256");for await(const chunk of bucket.openDownloadStream(id))hash.update(chunk);return hash.digest("hex");}
export async function importTables(db,tables,files) {
 const bucket=new GridFSBucket(db,{bucketName:"uploads"}), report={tables:{},files:files.length,verified:false};
 // Preflight all conflicts before writing any destination records or files.
 for(const name of applicationCollections)for(const doc of tables[name]){
  const prior=await db.collection(name).findOne({_id:doc._id});
  if(prior&&canonical(prior)!==canonical(doc))throw Error("Destination record conflict in "+name+": "+doc.id);
 }
 for(const file of files){
  const prior=await bucket.find({filename:file.key}).next();
  if(prior&&(prior.length!==file.size||await gridHash(bucket,prior._id)!==file.sha256))throw Error("Destination upload conflict: "+file.key);
 }
 for(const file of files){
  const prior=await bucket.find({filename:file.key}).next();
  if(!prior)await pipeline(createReadStream(file.filename),bucket.openUploadStream(file.key,{metadata:{contentType:file.contentType,sha256:file.sha256}}));
 }
 for(const name of applicationCollections){
  let inserted=0,skipped=0;
  for(const doc of tables[name]){
   // Atomic insert-if-absent; concurrent live edits are caught during verification.
   const result=await db.collection(name).updateOne({_id:doc._id},{$setOnInsert:doc},{upsert:true});
   if(result.upsertedCount)inserted++;else skipped++;
  }
  report.tables[name]={source:tables[name].length,inserted,skipped};
 }
 for(const name of applicationCollections)for(const doc of tables[name]){
  const actual=await db.collection(name).findOne({_id:doc._id});
  if(canonical(actual)!==canonical(doc))throw Error("Verification failed in "+name+": "+doc.id);
 }
 for(const file of files){
  const actual=await bucket.find({filename:file.key}).next();
  if(!actual||actual.length!==file.size||await gridHash(bucket,actual._id)!==file.sha256)throw Error("Upload verification failed: "+file.key);
 }
 report.verified=true;return report;
}
