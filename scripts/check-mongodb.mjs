import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";
import { Resolver } from "node:dns/promises";
const inherited=Boolean(process.env.MONGODB_URI);
const raw=await readFile(".env.local","utf8");
const names=["MONGODB_URI","MONGODB_DB","JAGUAR_TRUST_AUTH_HEADERS"];
const counts=Object.fromEntries(names.map(k=>[k,raw.split(/\r?\n/).filter(l=>new RegExp("^\\s*(?:export\\s+)?"+k+"\\s*=").test(l)).length]));
nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){console.error("Environment loader reported an error");}});
const uri=process.env.MONGODB_URI||"";
const details={file:".env.local",keys:counts,uriConfigured:Boolean(uri),inheritedURI:inherited,databaseConfigured:Boolean(process.env.MONGODB_DB),databaseHasWhitespace:/\s/.test(process.env.MONGODB_DB||""),uriProtocolValid:/^mongodb(?:\+srv)?:\/\//.test(uri),uriHasWhitespace:/\s/.test(uri),uriHasPlaceholder:/<[^>]+>|\byour[-_](?:password|username|cluster)|\bYOUR_ATLAS\b/i.test(uri),uriInvalidPercentEscape:/%(?![0-9a-f]{2})/i.test(uri)};
try{const parsed=new URL(uri);details.usernamePresent=Boolean(parsed.username);details.passwordPresent=Boolean(parsed.password);details.atlasHostname=parsed.hostname.endsWith(".mongodb.net");details.srvExplicitPort=parsed.protocol==="mongodb+srv:"&&Boolean(parsed.port);}catch{details.urlParseFailed=true;}
console.log(JSON.stringify(details,null,2));
if(process.argv.includes("--dns")) {
 const host=new URL(uri).hostname;
 const results=await Promise.all(["system","public"].map(async source=>{
  const resolver=new Resolver({timeout:2000,tries:1});if(source==="public")resolver.setServers(["1.1.1.1","8.8.8.8"]);
  try{const records=await resolver.resolveSrv("_mongodb._tcp."+host);return {source,srv:"success",serverCount:records.length};}
  catch(error){return {source,srv:"failed",code:error.code};}
 }));console.log(JSON.stringify({dns:results},null,2));process.exit(results.some(r=>r.srv==="success")?0:1);
}
let client;
const watchdog=setTimeout(()=>{console.log(JSON.stringify({connection:"failed",errorTypes:["DiagnosticTimeout"],note:"Connection or DNS resolution did not finish within 25 seconds"}));process.exit(1);},25000);
try{
 client=new MongoClient(uri,{serverSelectionTimeoutMS:10000,connectTimeoutMS:10000,appName:"jaguar-connection-diagnostic"});
 await client.connect();
 await client.db(process.env.MONGODB_DB||"vaagai_jaguar").command({ping:1});
 console.log(JSON.stringify({connection:"success",ping:"success"}));
}catch(error){
 const messages=[],codes=[],types=[];
 function visit(e,depth=0){if(!e||depth>6)return;if(e.message)messages.push(String(e.message));if(e.name)types.push(e.name);if(e.code!==undefined)codes.push(e.code);visit(e.cause,depth+1);if(e.reason?.servers)for(const value of e.reason.servers.values())visit(value.error,depth+1);}
 visit(error);
 const combined=messages.join("\n");
 console.log(JSON.stringify({connection:"failed",errorTypes:[...new Set(types)],errorCodes:[...new Set(codes)],authenticationFailure:/authentication failed|bad auth|auth failed/i.test(combined),dnsFailure:/ENOTFOUND|EAI_AGAIN|querySrv|queryTxt|DNS/i.test(combined),connectionRefused:/ECONNREFUSED/i.test(combined),timeout:/timed out|timeout|server selection/i.test(combined),tlsFailure:/SSL|TLS|certificate/i.test(combined),invalidURI:/Invalid connection string|URI malformed|unescaped|invalid scheme|Invalid scheme|empty userinfo|must be escaped/i.test(combined)},null,2));
 process.exitCode=1;
}finally{clearTimeout(watchdog);if(client)await client.close();}
