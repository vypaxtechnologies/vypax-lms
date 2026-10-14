require('dotenv').config({quiet:true});
const {MongoClient}=require('mongodb');
const fs=require('fs');
const path=require('path');
async function migrate(){
  if(!process.env.MONGODB_URI)throw new Error('Set MONGODB_URI before migration.');
  const client=new MongoClient(process.env.MONGODB_URI);
  try{
    await client.connect();const db=client.db(process.env.MONGODB_DATABASE||'vypax_lms');
    const directory=process.env.DATA_DIR||path.join(__dirname,'data');
    const read=(name,fallback)=>fs.existsSync(path.join(directory,name))?JSON.parse(fs.readFileSync(path.join(directory,name),'utf8')):fallback;
    const users=read('users.json',[]).filter(user=>user.role!=='ADMIN');
    const states=read('portal-data.json',{});
    for(const user of users){
      await db.collection('users').updateOne({email:user.email},{$setOnInsert:user},{upsert:true});
      if(states[user.id])await db.collection('portal_states').updateOne({_id:user.id},{$setOnInsert:{version:1,state:states[user.id]}},{upsert:true});
    }
    console.log(`Imported ${users.length} learner records. Existing records were preserved. Sessions are not imported; learners must sign in again.`);
  }finally{await client.close();}
}
migrate().catch(error=>{console.error(error.message);process.exitCode=1;});
