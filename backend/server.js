require('dotenv').config({path:require('path').resolve(__dirname,'../.env'),quiet:true});
const express=require('express');
const cors=require('cors');
const path=require('path');
const fs=require('fs');
const multer=require('multer');
const {Resend}=require('resend');
const {authRouter,connectDatabase,getDatabase,portalRouter,paymentRouter}=require('./auth');

const app=express();
const PORT=Number(process.env.PORT||5000);
const resend=process.env.RESEND_API_KEY?new Resend(process.env.RESEND_API_KEY):null;
const upload=multer();
const allowedOrigins=new Set([
  process.env.CLIENT_URL,
  process.env.VITE_SITE_URL,
  process.env.VITE_API_URL ? new URL(process.env.VITE_API_URL).origin : null,
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'https://vypax.pages.dev'
].filter(Boolean));

app.use(cors({
  origin(origin, callback){
    if(!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json({limit:'2mb'}));
app.use(express.urlencoded({extended:true,limit:'2mb'}));
app.use(upload.none());

app.use('/api/auth',authRouter());
app.use('/api/portal',portalRouter());
app.use('/api/payments',paymentRouter());

app.post('/api/enquiries',async(req,res)=>{
  if(!resend || !process.env.EMAIL_FROM || !process.env.EMAIL_TO){
    return res.status(503).json({error:'Enquiry email service is not configured.'});
  }

  const body=req.body||{};
  const {name,email,phone,enquiry_type,interest,background,message,consent,category}=body;
  try{
    const {error}=await resend.emails.send({
      from:process.env.EMAIL_FROM,
      to:process.env.EMAIL_TO,
      subject:`New Vypax Enquiry: ${enquiry_type||category||'General'} - ${interest||'Website enquiry'}`,
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
    if(error) throw error;
    return res.status(201).json({ok:true,message:'Enquiry email sent.'});
  }catch(emailErr){
    console.error('Failed to send enquiry email:',emailErr.message);
    return res.status(502).json({error:'Failed to send enquiry email.'});
  }
});

app.get('/api/health',(req,res)=>res.json({ok:true}));

const site=path.join(__dirname,'..','frontend','dist');
const publicSite=path.join(__dirname,'..','frontend','public','site');
app.use('/site',express.static(publicSite));
if(fs.existsSync(site)) app.use(express.static(site));

app.get(/^(?!\/api\/)(?!\/site\/).*$/, (req,res)=>{
  const indexFile=path.join(__dirname,'..','frontend','index.html');
  if(fs.existsSync(indexFile)) return res.sendFile(indexFile);
  return res.status(404).send('Not found');
});

async function start(){
  const connected=await connectDatabase();
  if(!connected)console.warn('Using file-backed account storage without MongoDB.');
  app.listen(PORT,()=>console.log(`Vypax website server running on http://localhost:${PORT}${getDatabase()?' (database enabled)':' (file-backed auth)'}`));
}
start().catch(error=>{
  console.error('Failed to start server:',error.message);
  process.exitCode=1;
});
