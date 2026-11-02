import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const manifest = JSON.parse(await fs.readFile("content/legacy-media-manifest.json","utf8"));
const env = Object.fromEntries((await fs.readFile("apps/admin/.env.local","utf8")).split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{ const i=l.indexOf("="); return [l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,"")]; }));
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
const endpoint = env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/legacy-media-import-20261020";
const root = path.resolve("..","personalproject-Abiali-Portfolio","static");
let uploaded=0, skipped=0;
for(let offset=0;offset<manifest.files.length;offset+=10) {
 const batch=manifest.files.slice(offset,offset+10);
 const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","x-import-key":process.env.LEGACY_UPLOAD_KEY},body:JSON.stringify({paths:batch.map(f=>f.path)})});
 if(!response.ok) throw new Error("Signing failed: "+response.status+" "+await response.text());
 const signed=await response.json();
 for(let i=0;i<batch.length;i+=3) await Promise.all(batch.slice(i,i+3).map(async file=>{
   const url=client.storage.from("portfolio").getPublicUrl(file.path).data.publicUrl;
   const check=await fetch(url,{method:"HEAD"});
   if(check.ok && Number(check.headers.get("content-length"))===file.bytes){skipped++;return;}
   const bytes=await fs.readFile(path.join(root,file.source));
   if(crypto.createHash("sha256").update(bytes).digest("hex")!==file.sha256) throw new Error("Source changed: "+file.source);
   const token=signed.find(s=>s.path===file.path).token;
   let error;
   for(let attempt=0;attempt<3;attempt++){
    const result=await client.storage.from("portfolio").uploadToSignedUrl(file.path,token,bytes,{contentType:file.contentType,cacheControl:"31536000"});
    error=result.error;
    if(!error)break;
   }
   if(error)throw new Error(file.source+": "+error.message);
   uploaded++;
 }));
 console.log(JSON.stringify({completed:Math.min(offset+10,manifest.files.length),total:manifest.files.length,uploaded,skipped}));
}
console.log("Upload complete.");
