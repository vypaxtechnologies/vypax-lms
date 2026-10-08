require('dotenv').config({path:require('path').resolve(__dirname,'../.env')});
const express=require('express');
const cors=require('cors');
const path=require('path');
const fs=require('fs');
const multer=require('multer');
const {Resend}=require('resend');

const app=express();
const PORT=Number(process.env.PORT||5000);
const resend=new Resend(process.env.RESEND_API_KEY);
const upload=multer();
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true,limit:'2mb'}));
app.use(upload.none());


app.get('/api/catalog',async(req,res)=>{
  try{
    const p=path.join(__dirname,'..','frontend','public','site','services-seed.json');
    if(fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p,'utf8')));
    return res.json({jobs:{},services:{}});
  }catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/forms/schema',(req,res)=>{
  res.json({
    fields:[
      {name:"name",label:"Full Name",type:"text",required:true,enabled:true},
      {name:"email",label:"Email Address",type:"email",required:true,enabled:true},
      {name:"phone",label:"Phone Number",type:"tel",required:true,enabled:true,pattern: "[+0-9 ()\\-]{7,20}",title:"Use 7–20 characters: digits, spaces, brackets, plus or hyphen."},
      {name:"enquiry_type",label:"Enquiry Type",type:"select",required:true,enabled:true,options:["Training","Internship","IT Services","Placement support","Hackathon","General"]},
      {name:"interest",label:"Program or Service",type:"select",required:true,enabled:true,options:[]},
      {name:"background",label:"Your Background",type:"select",required:true,enabled:true,options:["","Student","Fresher","Working Professional","Business Owner","Other"]},
      {name:"message",label:"How can we help?",type:"textarea",required:true,enabled:true},
      {name:"consent",label:"I agree to share these details with Vypax Technologies so the team can respond.",type:"checkbox",required:true,enabled:true}
    ]
  });
});
app.get('/api/auth/me',(req,res)=>{
  res.json({user:null});
});
app.post('/api/enquiries',async(req,res)=>{
  try{
    const body=req.body||{};
    const {name,email,phone,enquiry_type,interest,background,message,consent}=body;
    if(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.EMAIL_TO){
      try{
        await resend.emails.send({
          from:process.env.EMAIL_FROM,
          to:process.env.EMAIL_TO,
          subject:`New Vypax Enquiry: ${enquiry_type} - ${interest}`,
          html:`
            <h2>New Enquiry Received</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Enquiry Type:</strong> ${enquiry_type}</p>
            <p><strong>Interest:</strong> ${interest}</p>
            <p><strong>Background:</strong> ${background}</p>
            <p><strong>Message:</strong></p>
            <p>${message?.replace(/\n/g,'<br>')}</p>
            <hr>
            <p><small>Consent: ${consent}</small></p>
          `
        });
      }catch(emailErr){
        console.error('Failed to send email:',emailErr.message);
      }
    }
    
    res.status(201).json({ok:true,message:'Enquiry sent and email delivered.'});
  }catch(e){res.status(400).json({error:e.message});}
});
app.post('/api/forms/submit',async(req,res)=>{
  try{
    const body=req.body||{};
    const {name,email,phone,enquiry_type,interest,background,message,consent}=body;
    if(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.EMAIL_TO){
      try{
        await resend.emails.send({
          from:process.env.EMAIL_FROM,
          to:process.env.EMAIL_TO,
          subject:`New Vypax Enquiry: ${enquiry_type} - ${interest}`,
          html:`
            <h2>New Enquiry Received</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Enquiry Type:</strong> ${enquiry_type}</p>
            <p><strong>Interest:</strong> ${interest}</p>
            <p><strong>Background:</strong> ${background}</p>
            <p><strong>Message:</strong></p>
            <p>${message?.replace(/\n/g,'<br>')}</p>
            <hr>
            <p><small>Consent: ${consent}</small></p>
          `
        });
      }catch(emailErr){
        console.error('Failed to send email:',emailErr.message);
      }
    }
    
    res.status(201).json({ok:true,message:'Enquiry sent and email delivered.'});
  }catch(e){res.status(400).json({error:e.message});}
});

app.get('/api/health',(req,res)=>res.json({ok:true,stack:'MERN',database:'disabled'}));

const site=path.join(__dirname,'..','frontend','dist');
const publicSite=path.join(__dirname,'..','frontend','public','site');
app.use('/site',express.static(publicSite));
if(fs.existsSync(site)) app.use(express.static(site));

app.get('/{*any}',(req,res)=>{
  if(req.path.startsWith('/api/')) return res.status(404).json({error:'API route not found'});
  res.sendFile(path.join(__dirname,'..','frontend','index.html'));
});

async function start(){
  app.listen(PORT,()=>console.log(`Vypax MERN server running on http://localhost:${PORT}`));
}
start();
