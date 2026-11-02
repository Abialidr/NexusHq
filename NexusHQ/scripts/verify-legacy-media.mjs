import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const manifest = JSON.parse(await fs.readFile("content/legacy-media-manifest.json","utf8"));
const env = Object.fromEntries((await fs.readFile("apps/admin/.env.local","utf8")).split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^["']|["']$/g,"")];}));
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
let verified=0;
for(let i=0;i<manifest.files.length;i+=8) await Promise.all(manifest.files.slice(i,i+8).map(async file=>{
 const url=client.storage.from("portfolio").getPublicUrl(file.path).data.publicUrl;
 const response=await fetch(url,{method:"HEAD"});
 if(!response.ok || Number(response.headers.get("content-length"))!==file.bytes || !response.headers.get("content-type")?.startsWith(file.contentType)) throw new Error("Public asset verification failed: "+file.path);
 verified++;
}));
const video=manifest.files.find(f=>f.contentType.startsWith("video/"));
const response=await fetch(client.storage.from("portfolio").getPublicUrl(video.path).data.publicUrl,{headers:{Range:"bytes=0-1023"}});
if(response.status!==206 || (await response.arrayBuffer()).byteLength!==1024) throw new Error("Video range requests failed");
console.log(JSON.stringify({verified,total:manifest.files.length,videoRangeRequests:true}));
