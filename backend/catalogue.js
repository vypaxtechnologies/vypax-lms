const path = require('path');
const express = require('express');

module.exports = function createCatalogue({defaults, getDatabase, readJson, writeJson, dataDir}) {
  const file = path.join(dataDir, 'catalogue.json');
  const types = ['training','internships','jobs'];
  async function list() {
    const db=getDatabase();
    const saved=db?await db.collection('catalogue').find({}).toArray():Object.values(await readJson(file,{}));
    const items=new Map(defaults.map(item=>[item.id,{...item,published:true,version:0,managed:false}]));
    for(const item of saved)items.set(item.id,item);
    return [...items.values()].map(({_id,...item})=>item);
  }
  async function save(body, user) {
    const id=String(body.id||'').trim();
    const invalid=message=>{const error=new Error(message);error.status=400;throw error};
    if(!/^[a-z][a-z0-9-]{2,80}$/.test(id)||!types.includes(body.type))invalid('Choose a valid listing type and ID.');
    const items=await list(), previous=items.find(item=>item.id===id);
    if(previous&&previous.type!==body.type)invalid('An existing listing cannot change type.');
    if(Number(body.version)!==(previous?.version||0)){const error=new Error('This listing changed. Refresh before saving.');error.status=409;throw error}
    const text=(key,max,required=false)=>{const value=String(body[key]||'').trim();if(value.length>max||(required&&!value))invalid('Check the '+key+' field.');return value};
    const number=(key,min,max)=>{const value=Number(body[key]);if(!Number.isInteger(value)||value<min||value>max)invalid('Check the '+key+' value.');return value};
    if(typeof body.published!=='boolean')invalid('Choose draft or published status.');
    const item={id,type:body.type,title:text('title',120,true),description:text('description',3000,true),category:text('category',80),location:text('location',120),durationMonths:number('durationMonths',1,24),fee:number('fee',0,1000000),notes:text('notes',20000),requirements:text('requirements',3000),published:body.published,version:(previous?.version||0)+1,managed:true,legacyTitle:previous?.legacyTitle||previous?.title||'',updatedAt:new Date().toISOString(),updatedBy:user.id};
    item.fees={};
    for(const months of [1,2,3,6])item.fees[months]=number('fee'+months,0,1000000);
    const db=getDatabase();
    if(db){
      const stored=await db.collection('catalogue').findOne({_id:id});
      if(stored){const result=await db.collection('catalogue').replaceOne({_id:id,version:body.version},{_id:id,...item});if(!result.modifiedCount){const error=new Error('This listing changed. Refresh before saving.');error.status=409;throw error}}
      else{try{await db.collection('catalogue').insertOne({_id:id,...item})}catch(error){if(error.code===11000)error.status=409;throw error}}
    }else{const records=await readJson(file,{});records[id]=item;await writeJson(file,records)}
    return item;
  }
  function publicRouter(){const router=express.Router();router.get('/',async(req,res)=>{const items=await list();res.set('Cache-Control','no-store');res.json({items:items.filter(item=>item.published).map(({notes,updatedBy,...item})=>item),hidden:items.filter(item=>!item.published&&item.legacyTitle).map(item=>({type:item.type,title:item.legacyTitle}))})});return router}
  function mountAdmin(router){router.get('/catalogue',async(req,res)=>res.json({items:await list()}));router.post('/catalogue',async(req,res)=>res.json({item:await save(req.body||{},req.user),message:'Listing saved.'}));}
  return {list,save,publicRouter,mountAdmin};
};
