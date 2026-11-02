import assert from "node:assert/strict";
import { readPortfolioContent } from "../src/lib/content/read-supabase-content.ts";
const content = await readPortfolioContent();
assert.equal(content.profile.name,"Abiali Doctor");
assert.ok(content.profile.avatarUrl?.includes("/storage/v1/object/public/portfolio/"));
assert.ok(content.profile.resumeUrl?.endsWith("/resume.pdf"));
assert.ok(!JSON.stringify(content).includes("[YOUR NAME]"));
for(const project of content.projects){
 assert.ok(project.slug);
 assert.ok(project.coverImageUrl?.startsWith("https://"));
 for(const item of project.media ?? []) assert.ok(item.url.startsWith("https://"));
}
console.log(JSON.stringify({profile:content.profile.name,projects:content.projects.length,experience:content.experience.length,education:content.education.length,skills:content.skills.length,articles:content.articles.length,portrait:true,resume:true}));
