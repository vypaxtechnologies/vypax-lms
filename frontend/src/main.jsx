import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ALL_SITE_PAGES,SEO_PAGES,SITE_ORIGIN} from './seo-pages.js';
import './shell.css';

const pagesByFile=new Map(ALL_SITE_PAGES.map(page=>[page.file,page]));
const indexableFiles=new Set(SEO_PAGES.map(page=>page.file));

function pageFromPath(path){
  const clean=path.replace(/^\/+|\/+$/g,'');
  if(!clean)return 'index.html';
  if(clean.includes('/'))return null;
  const file=clean.endsWith('.html')?clean:`${clean}.html`;
  return pagesByFile.has(file)?file:null;
}
function updatePageMetadata(file){
  const page=pagesByFile.get(file)||SEO_PAGES[0];
  const canonical=new URL(page.path,SITE_ORIGIN).href;
  const description=page.description||'';
  document.title=page.title;
  const values=[
    ['name','description',description],
    ['name','robots',indexableFiles.has(file)?'index,follow':'noindex,follow'],
    ['property','og:title',page.title],
    ['property','og:description',description],
    ['property','og:url',canonical],
    ['name','twitter:title',page.title],
    ['name','twitter:description',description]
  ];
  for(const [attribute,name,content] of values){
    let element=document.head.querySelector(`meta[${attribute}="${name}"]`);
    if(!element){
      element=document.createElement('meta');
      element.setAttribute(attribute,name);
      document.head.append(element);
    }
    element.setAttribute('content',content);
  }
  let canonicalLink=document.head.querySelector('link[rel="canonical"]');
  if(!canonicalLink){
    canonicalLink=document.createElement('link');
    canonicalLink.rel='canonical';
    document.head.append(canonicalLink);
  }
  canonicalLink.href=canonical;
}

function App(){
  const frame=useRef(null);
  const [src,setSrc]=useState(()=>{
    const page=pageFromPath(location.pathname);
    return page?'/site/'+page+location.search+location.hash:null;
  });
  useEffect(()=>{
    const sync=()=>{
      const page=pageFromPath(location.pathname);
      setSrc(page?'/site/'+page+location.search+location.hash:null);
    };
    window.addEventListener('popstate',sync);
    return()=>window.removeEventListener('popstate',sync);
  },[]);
  useEffect(()=>{
    const page=pageFromPath(location.pathname);
    if(page){
      updatePageMetadata(page);
    }else{
      document.title='Page Not Found | Vypax Technologies';
      const robots=document.head.querySelector('meta[name="robots"]');
      if(robots)robots.content='noindex,follow';
      document.head.querySelector('link[rel="canonical"]')?.remove();
    }
  },[src]);
  const onLoad=()=>{
    const w=frame.current?.contentWindow,d=frame.current?.contentDocument;
    if(!w||!d)return;
    const sync=()=>{
      const path=w.location.pathname.replace('/site','')||'/';
      const target=path+(w.location.search||'')+(w.location.hash||'');
      const current=location.pathname+location.search+location.hash;
      if(target!==current)history.pushState({},'',target);
    };
    d.addEventListener('click',e=>{
      const a=e.target.closest?.('a');
      if(a&&a.href&&new URL(a.href).origin===location.origin){
        const u=new URL(a.href);
        if(u.pathname.startsWith('/site/')){
          const page=pageFromPath(u.pathname);
          if(!page)return;
          e.preventDefault();
          history.pushState({},'',pagesByFile.get(page).path+u.search+u.hash);
          setSrc(page?'/site/'+page+u.search+u.hash:null);
        }
      }
    });
    w.addEventListener('popstate',sync);
  };
  if(!src)return <main className="not-found"><h1>Page not found</h1><p>The page you requested does not exist.</p><a href="/">Return to Vypax Technologies</a></main>;
  return <iframe ref={frame} className="site-frame" src={src} onLoad={onLoad} title="Vypax Technologies"/>;
}
createRoot(document.getElementById('root')).render(<App/>);
