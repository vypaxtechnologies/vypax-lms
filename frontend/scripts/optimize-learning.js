import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist/site');
const context={window:{}};
vm.runInNewContext(await readFile(path.join(site,'learning-data.js'),'utf8'),context);
const skills=context.window.VYPAX_LEARNING;
if(!Array.isArray(skills))throw new Error('Learning catalogue is invalid');
await mkdir(path.join(site,'learning'),{recursive:true});
const manifest={};
for(const [index,skill] of skills.entries()){
  const file=`learning/skill-${index}.json`;
  manifest[skill.slug]=file;
  await writeFile(path.join(site,file),JSON.stringify(skill));
}
// Keep the existing script URL; download only the selected skill's lessons.
await writeFile(path.join(site,'learning-data.js'),`(()=>{const files=${JSON.stringify(manifest)};const base=new URL('.',document.currentScript.src);const file=files[new URLSearchParams(location.search).get('skill')];window.VYPAX_LEARNING_READY=file?fetch(new URL(file,base)).then(response=>{if(!response.ok)throw new Error('Lessons could not be loaded. Please retry.');return response.json()}).then(skill=>{window.VYPAX_LEARNING=[skill]}):Promise.resolve();})();`);
// This obsolete bundle has no references in the public pages.
await unlink(path.join(site,'index.js')).catch(error=>{if(error.code!=='ENOENT')throw error});
console.log(`Split learning content into ${skills.length} on-demand skill files.`);

const quizContext={window:{}};
vm.runInNewContext(await readFile(path.join(site,'quizzes-data.js'),'utf8'),quizContext);
const quizSkills=quizContext.window.VYPAX_QUIZ_SKILLS;
if(!Array.isArray(quizSkills))throw new Error('Quiz catalogue is invalid');
await mkdir(path.join(site,'quizzes'),{recursive:true});
for(const [index,skill] of quizSkills.entries()){
  await writeFile(path.join(site,'quizzes',`skill-${index}.json`),JSON.stringify(skill.quizzes));
}
const catalogue=quizSkills.map(({name},index)=>({name,file:`quizzes/skill-${index}.json`}));
await writeFile(path.join(site,'quizzes-data.js'),`(()=>{const base=new URL('.',document.currentScript.src);window.VYPAX_QUIZ_SKILLS=${JSON.stringify(catalogue)};window.VYPAX_LOAD_QUIZZES=async skill=>{if(skill.quizzes)return;const response=await fetch(new URL(skill.file,base));if(!response.ok)throw new Error('Quizzes could not be loaded. Please retry.');skill.quizzes=await response.json()};})();`);
console.log(`Split quiz content into ${quizSkills.length} on-demand skill files.`);
