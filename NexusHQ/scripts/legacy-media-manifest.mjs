import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const root = path.resolve("..", "personalproject-Abiali-Portfolio", "static");
const groups = {
  wedfield: ["wedcell", "wedcelladmin", "wedcellVendors", "wback"],
  "zanadu-health": ["zanadu", "zbackend"], spotsaver: ["spotsaver"],
  niusafe: ["Niu"], neforia: ["Neforia"], "wedcell-institute": ["institute"],
  "dharamveer-foundation": ["dharamveer"], "audio-player": ["audio"],
  "avantica-design-exercise": ["avantika"], "d3-bubble-chart": ["bubble"],
  "family-tree": ["familyTree"], "jethitech-design-exercise": ["jethi"],
  "panchatattva-design-exercise": ["panch"], "water-tank": ["water"],
  "art-memory-game": ["memory"], calculator: ["calc"]
};
const mime = {".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".webm":"video/webm",".mp4":"video/mp4",".pdf":"application/pdf"};
const files = [];
const projects = [];
for (const [slug, folders] of Object.entries(groups)) {
  const media = [];
  for (const folder of folders) {
    const dir = path.join(root, "Project", folder);
    const names = fs.readdirSync(dir).sort((a,b) => a.localeCompare(b, undefined, {numeric:true}));
    for (const name of names) {
      const ext = path.extname(name).toLowerCase();
      if (!mime[ext]) continue;
      const source = "Project/" + folder + "/" + name;
      const target = "legacy-20261020/" + source;
      const bytes = fs.readFileSync(path.join(root, source));
      files.push({source, path:target, bytes:bytes.length, sha256:crypto.createHash("sha256").update(bytes).digest("hex"), contentType:mime[ext]});
      if (/logo|thum/i.test(name)) continue;
      const kind = mime[ext].startsWith("video") ? "video" : "image";
      media.push({kind, path:target, label:folder + " — " + (kind === "video" ? "Demo " : "Screenshot ") + path.basename(name,ext)});
    }
  }
  projects.push({slug, cover_path:media.find(m => m.kind === "image")?.path ?? null, media});
}
for (const [source, target] of [["MyImage.jpg","portrait.jpg"],["AbialiCV.pdf","resume.pdf"]]) {
  const bytes = fs.readFileSync(path.join(root,source));
  files.push({source, path:"legacy-20261020/profile/"+target, bytes:bytes.length, sha256:crypto.createHash("sha256").update(bytes).digest("hex"), contentType:mime[path.extname(source).toLowerCase()]});
}
console.log(JSON.stringify({bucket:"portfolio",profile:{avatar_path:"legacy-20261020/profile/portrait.jpg",resume_path:"legacy-20261020/profile/resume.pdf"},files,projects},null,2));
