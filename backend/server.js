require('dotenv').config({path:require('path').resolve(__dirname,'../.env'),quiet:true});
const express=require('express');
const cors=require('cors');
const path=require('path');
const fs=require('fs');
const multer=require('multer');
const {Resend}=require('resend');
const {authRouter,connectDatabase,getDatabase,portalRouter,paymentRouter,adminRouter}=require('./auth');

const app=express();
const PORT=Number(process.env.PORT||5000);
const resend=process.env.RESEND_API_KEY?new Resend(process.env.RESEND_API_KEY):null;
const upload=multer();
const publicFormUpload=multer({limits:{fields:8,fieldSize:10000}}).none();
const careerUpload=multer({limits:{fileSize:5*1024*1024,fieldSize:10000}});
app.set('trust proxy',1);
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

app.use('/api/auth',authRouter());
app.use('/api/portal',portalRouter());
app.use('/api/payments',paymentRouter());
app.use('/api/admin',adminRouter());

const careerRoles=new Set(['Business Development Executive','Sales Executive','Lead Generation Executive','HR Intern']);
const careerApplicationFields=[
  ['position','Position Applied For'],
  ['name','Name'],
  ['email','Email'],
  ['phone','Phone'],
  ['city','City'],
  ['state','State / Region'],
  ['country','Country'],
  ['qualification','Highest Qualification'],
  ['specialisation','Specialisation'],
  ['institution','College / Institution'],
  ['graduation_year','Graduation Year'],
  ['experience_level','Experience Level'],
  ['experience_years','Total Experience (Years)'],
  ['company','Current / Most Recent Company'],
  ['job_title','Current / Most Recent Job Title'],
  ['current_ctc','Current Annual CTC'],
  ['skills','Key Skills'],
  ['achievements','Projects / Achievements'],
  ['availability','Joining Availability'],
  ['expected_ctc','Expected Annual CTC'],
  ['linkedin','LinkedIn Profile'],
  ['portfolio','Portfolio / Work Samples'],
  ['motivation','Motivation']
];
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,character=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
})[character]);
const validEmail=value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const validPhone=value=>/^[+0-9 ()-]{7,20}$/.test(value);
const partnerInterests=new Set([
  'College / university partnership',
  'Mentoring / judging',
  'Hackathon sponsorship',
  'Hiring / talent partnership',
  'Venue / community partnership'
]);
const paidInternshipDomains=new Set([
  'internship-data-analytics',
  'internship-ai-ml',
  'internship-web-development',
  'internship-business-analytics',
  'internship-digital-marketing',
  'internship-ui-ux',
  'internship-cybersecurity',
  'internship-frontend-development',
  'internship-backend-development',
  'internship-full-stack-development',
  'internship-python-development',
  'internship-java-development',
  'internship-mobile-app-development',
  'internship-cloud-devops',
  'internship-database-engineering',
  'internship-software-testing',
  'internship-generative-ai',
  'internship-ai-agents',
  'internship-data-engineering',
  'internship-blockchain-development',
  'internship-human-resource-management',
  'internship-talent-acquisition',
  'internship-business-development',
  'internship-sales-management',
  'internship-marketing-management',
  'internship-operations-management',
  'internship-project-management',
  'internship-product-management',
  'internship-finance-accounting',
  'internship-supply-chain-management',
  'internship-customer-success',
  'internship-business-strategy',
  'internship-entrepreneurship'
]);

async function sendPublicFormEmail(res,{title,subject,replyTo,fields,message}){
  if(!resend||!process.env.EMAIL_FROM||!process.env.EMAIL_TO){
    return res.status(503).json({error:'Form email service is not configured.'});
  }
  const rows=fields.map(([label,value])=>`<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value).replace(/\r?\n/g,'<br>')}</td></tr>`).join('');
  try{
    const {error}=await resend.emails.send({
      from:process.env.EMAIL_FROM,
      to:process.env.EMAIL_TO,
      replyTo,
      subject,
      html:`<h2>${escapeHtml(title)}</h2><table cellpadding="6" cellspacing="0" border="1">${rows}</table>`,
      text:`${title}\n\n${fields.map(([label,value])=>`${label}: ${value}`).join('\n')}`
    });
    if(error)throw error;
    return res.status(201).json({ok:true,message});
  }catch(emailErr){
    console.error(`Failed to send ${title.toLowerCase()} email:`,emailErr.message);
    return res.status(502).json({error:'Failed to send your form. Please try again later.'});
  }
}

app.post('/api/hackathon-partners',publicFormUpload,async(req,res)=>{
  const body=req.body||{};
  const fields={
    name:String(body.name||'').trim(),
    organisation:String(body.organisation||'').trim(),
    email:String(body.email||'').trim(),
    phone:String(body.phone||'').trim(),
    interest:String(body.interest||'').trim(),
    message:String(body.message||'').trim()
  };
  if(fields.name.length<2||fields.name.length>100)return res.status(400).json({error:'Please provide your name (2–100 characters).'});
  if(!fields.organisation||fields.organisation.length>150)return res.status(400).json({error:'Please provide your organisation (up to 150 characters).'});
  if(fields.email.length>254||!validEmail(fields.email))return res.status(400).json({error:'Please provide a valid email address.'});
  if(!validPhone(fields.phone))return res.status(400).json({error:'Please provide a valid mobile number.'});
  if(!partnerInterests.has(fields.interest))return res.status(400).json({error:'Please choose a valid partnership interest.'});
  if(fields.message.length<10||fields.message.length>2000)return res.status(400).json({error:'Please provide a message (10–2,000 characters).'});
  if(body.consent!=='Agreed')return res.status(400).json({error:'Please confirm the consent statement.'});

  return sendPublicFormEmail(res,{
    title:'New Hackathon Partnership Enquiry',
    subject:`Hackathon Partnership Enquiry: ${fields.interest}`,
    replyTo:fields.email,
    fields:[
      ['Name',fields.name],
      ['Organisation',fields.organisation],
      ['Email',fields.email],
      ['Mobile number',fields.phone],
      ['Partnership interest',fields.interest],
      ['Message',fields.message],
      ['Consent','Agreed']
    ],
    message:'Your partnership enquiry was sent successfully. The Vypax team will be in touch.'
  });
});

app.post('/api/paid-internship-applications',publicFormUpload,async(req,res)=>{
  const body=req.body||{};
  const fields={
    name:String(body.name||'').trim(),
    email:String(body.email||'').trim(),
    phone:String(body.phone||'').trim(),
    domain:String(body.domain||'').trim(),
    months:String(body.months||'').trim()
  };
  if(fields.name.length<2||fields.name.length>100)return res.status(400).json({error:'Please provide your name (2–100 characters).'});
  if(fields.email.length>254||!validEmail(fields.email))return res.status(400).json({error:'Please provide a valid email address.'});
  if(!validPhone(fields.phone))return res.status(400).json({error:'Please provide a valid mobile number.'});
  if(!paidInternshipDomains.has(fields.domain))return res.status(400).json({error:'Please choose a valid internship domain.'});
  if(!['1','2','3','6'].includes(fields.months))return res.status(400).json({error:'Please choose a valid internship duration.'});
  if(body.consent!=='Agreed')return res.status(400).json({error:'Please confirm the consent statement.'});

  const domainName=fields.domain.replace(/^internship-/,'').split('-').map(word=>word==='ai'?'AI':word.charAt(0).toUpperCase()+word.slice(1)).join(' ');
  return sendPublicFormEmail(res,{
    title:'New Paid Internship Application',
    subject:`Paid Internship Application: ${domainName}`,
    replyTo:fields.email,
    fields:[
      ['Name',fields.name],
      ['Email',fields.email],
      ['Mobile number',fields.phone],
      ['Internship domain',domainName],
      ['Duration / fee',`${fields.months} month${fields.months==='1'?'':'s'} — ₹${({'1':'499','2':'999','3':'1,299','6':'1,999'})[fields.months]}`],
      ['Consent','Agreed']
    ],
    message:'Your internship application was sent successfully. The Vypax team will be in touch.'
  });
});

app.post('/api/career-applications',careerUpload.single('attachment'),async(req,res)=>{
  if(!resend||!process.env.EMAIL_FROM||!(process.env.CAREER_EMAIL_TO||process.env.EMAIL_TO)){
    return res.status(503).json({error:'Career application email service is not configured.'});
  }

  const body=req.body||{};
  const requiredFields=['position','name','email','phone','city','state','country','qualification','specialisation','institution','graduation_year','experience_level','skills','availability'];
  const missing=requiredFields.filter(field=>!String(body[field]||'').trim());
  if(missing.length)return res.status(400).json({error:`Please complete all required fields: ${missing.join(', ')}.`});
  if(!careerRoles.has(String(body.position).trim()))return res.status(400).json({error:'Please choose a valid open position.'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim()))return res.status(400).json({error:'Please provide a valid email address.'});
  if(!/^\d{4}$/.test(String(body.graduation_year).trim()))return res.status(400).json({error:'Graduation year must contain four digits.'});
  if(!['Fresher','Experienced'].includes(body.experience_level))return res.status(400).json({error:'Please choose a valid experience level.'});
  if(body.experience_level==='Experienced'&&(!String(body.experience_years||'').trim()||!String(body.company||'').trim()||!String(body.job_title||'').trim())){
    return res.status(400).json({error:'Experienced applicants must provide years of experience, company and job title.'});
  }
  if(body.candidate_consent!=='Agreed')return res.status(400).json({error:'Please confirm the recruitment consent statement.'});
  if(String(body._honey||'').trim())return res.status(400).json({error:'Career application could not be accepted.'});
  if(!req.file)return res.status(400).json({error:'Please attach your résumé.'});

  const filename=path.basename(req.file.originalname).replace(/[^\w.-]/g,'_');
  if(!/\.(pdf|doc|docx)$/i.test(filename))return res.status(400).json({error:'Résumé must be a PDF, DOC or DOCX file.'});

  const fields=careerApplicationFields
    .map(([key,label])=>`<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(body[key]).replace(/\r?\n/g,'<br>')}</td></tr>`)
    .join('');
  try{
    const {error}=await resend.emails.send({
      from:process.env.EMAIL_FROM,
      to:process.env.CAREER_EMAIL_TO||process.env.EMAIL_TO,
      replyTo:String(body.email).trim(),
      subject:`Career Application: ${String(body.position).trim()} — ${String(body.name).trim()}`,
      html:`<h2>New Career Application</h2><table cellpadding="6" cellspacing="0" border="1">${fields}</table><p>The applicant's résumé is attached.</p>`,
      text:`New Career Application\n\n${careerApplicationFields.map(([key,label])=>`${label}: ${String(body[key]||'')}`).join('\n')}\n\nThe applicant's résumé is attached.`,
      attachments:[{filename,content:req.file.buffer.toString('base64')}]
    });
    if(error)throw error;
    return res.status(201).json({ok:true,message:'Career application sent successfully. The Vypax team will review your application.'});
  }catch(emailErr){
    console.error('Failed to send career application email:',emailErr.message);
    return res.status(502).json({error:'Failed to send career application. Please try again later.'});
  }
});

app.post('/api/enquiries',upload.none(),async(req,res)=>{
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

app.use('/api',(req,res)=>res.status(404).json({error:`API route not found: ${req.method} ${req.path}`}));
app.use('/api',(error,req,res,next)=>{
  if(res.headersSent)return next(error);
  const status=error.code==='LIMIT_FILE_SIZE'?413:Number.isInteger(error.status)?error.status:500;
  const message=error.code==='LIMIT_FILE_SIZE'?'Uploaded file exceeds the 5 MB size limit.':status<500?error.message:'API request failed.';
  return res.status(status).json({error:message});
});

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
