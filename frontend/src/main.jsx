import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './shell.css';

const knownPages = new Set([
  'index.html','about.html','contact.html','services.html','skills.html','training.html','account.html','portal.html',
  'careers.html','hackathons.html','hackathon-2026.html','hackathon-for-professionals.html',
  'hackathon-march-2027.html','communication-registration.html','career-path.html','programs.html',
  'internships.html','internship-application.html','certificate-demo.html',
  'partner.html','lesson.html','skill.html',
  'career-application.html','program-full-stack-development.html','program-frontend-development.html',
  'program-backend-development.html','program-data-analyst.html','program-data-science.html',
  'program-generative-ai.html','program-human-resource.html','program-business-analytics.html',
  'program-communication-skills.html','internship-data-analytics.html','internship-ai-ml.html',
  'internship-web-development.html','internship-business-analytics.html','internship-digital-marketing.html',
  'internship-ui-ux.html','internship-cybersecurity.html'
]);

function pageFromPath(path){
  const clean=path.split('?')[0].replace(/^\/+/,'');
  if(!clean || clean==='/') return 'index.html';
  const last=clean.split('/').pop();
  return knownPages.has(last)?last:'index.html';
}
function App(){
 const frame=useRef(null);
 const [src,setSrc]=useState('/site/'+pageFromPath(location.pathname)+location.search+location.hash);
 useEffect(()=>{
   const sync=()=>setSrc('/site/'+pageFromPath(location.pathname)+location.search+location.hash);
   window.addEventListener('popstate',sync);
   return()=>window.removeEventListener('popstate',sync);
 },[]);
 const onLoad=()=>{
   const w=frame.current?.contentWindow,d=frame.current?.contentDocument;
   if(!w||!d)return;
   const sync=()=>{
     const path=w.location.pathname.replace('/site','')||'/';
     const target=path+(w.location.search||'')+(w.location.hash||'');
     const current=location.pathname+location.search+location.hash;
     if(target!==current) history.pushState({},'',target);
   };
   d.addEventListener('click',e=>{
     const a=e.target.closest?.('a');
     if(a && a.href && new URL(a.href).origin===location.origin){
       const u=new URL(a.href);
       if(u.pathname.startsWith('/site/')){
         e.preventDefault();
         history.pushState({},'',u.pathname.replace('/site','')+u.search+u.hash);
         setSrc('/site/'+pageFromPath(u.pathname)+u.search+u.hash);
       }
     }
   });
   w.addEventListener('popstate',sync);
 };
 return <iframe ref={frame} className="site-frame" src={src} onLoad={onLoad} title="Vypax Technologies"/>;
}
createRoot(document.getElementById('root')).render(<App/>);
