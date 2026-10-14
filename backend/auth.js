const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const { MongoClient } = require('mongodb');
let database, mongoClient;
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const RESET_TOKENS_FILE = path.join(DATA_DIR, 'reset-tokens.json');
const PORTAL_DATA_FILE = path.join(DATA_DIR, 'portal-data.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_SITE_DIR = path.join(__dirname, '..', 'frontend', 'public', 'site');
const PORTAL_CONTENT_FILE = path.join(PUBLIC_SITE_DIR, 'portal-content.json');
const HACKATHON_DATA_FILE = path.join(PUBLIC_SITE_DIR, 'hackathons-data.json');
const INTERNSHIP_ASSESSMENTS_FILE = path.join(PUBLIC_SITE_DIR, 'internship-assessments.json');

const DEFAULT_ADMIN_EMAIL = 'vypaxtechnologies@gmail.com';
const DEFAULT_ADMIN_PASSWORD = '';

function getConfiguredAdminCredentials() {
  return {
    email: normalizeEmail(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL),
    password: String(process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD)
  };
}
const DEFAULT_JOBS = [
  {id:'sales-executive',name:'Sales Executive',description:'Develop customer relationships and support business growth.',location:'Remote',status:'Applications open',requirements:['Communication and sales skills']},
  { id: 'business-development-executive', name: 'Business Development Executive', description: 'Generate opportunities and grow learner and business relationships.', location: 'Bengaluru / Remote', status: 'Applications open', requirements: ['Strong communication', 'Sales focus', 'CRM comfort'] },
  { id: 'lead-generation-executive', name: 'Lead Generation Executive', description: 'Identify qualified leads and support funnel growth for student and corporate programmes.', location: 'Remote', status: 'Applications open', requirements: ['Research and outreach', 'Email and phone outreach', 'Good follow-up discipline'] },
  { id: 'hr-intern', name: 'HR Intern', description: 'Support recruitment coordination, onboarding, and learner engagement workflows.', location: 'Bengaluru', status: 'Internship', requirements: ['Organised and patient', 'Professional communication', 'Documentation skills'] }
];

const baseContent = JSON.parse(fs.readFileSync(PORTAL_CONTENT_FILE,'utf8'));
const catalogue = require('./catalogue')({
  defaults:[...Object.entries(baseContent.courses||{}).map(([id,item])=>({id,type:'training',title:item.name||id,description:item.description||'Training program',category:item.category||'Training',durationMonths:6,fee:0,fees:{1:499,2:999,3:1299,6:1999},notes:'',requirements:''})),...Object.entries(baseContent.internships||{}).map(([id,item])=>({id,type:'internships',title:item.name||id,description:item.description||'Practical internship program',category:'Internship',durationMonths:1,fee:499,fees:{1:499,2:999,3:1299,6:1999},notes:'',requirements:''})),...DEFAULT_JOBS.map(item=>({...item,type:'jobs',title:item.name,durationMonths:1,fee:0,fees:{1:0,2:0,3:0,6:0},requirements:item.requirements.join('\n'),notes:''}))],
  getDatabase:()=>database,readJson,writeJson,dataDir:DATA_DIR
});

async function ensureStorage() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const users = await getUsers();
  const { email: adminEmail, password: adminPassword } = getConfiguredAdminCredentials();

  if (adminPassword && !users.some((user) => normalizeEmail(user.email) === adminEmail)) {
    const { salt, hash } = hashPassword(adminPassword);
    users.push({
      id: 'admin-'+crypto.randomUUID(),
      name: 'Vypax Administrator',
      email: adminEmail,
      phone: '+91 0000000000',
      role: 'ADMIN',
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString()
    });
    await writeUsers(users);
  }
  const configuredUser=users.find(user=>normalizeEmail(user.email)===adminEmail);
  if(adminPassword&&configuredUser&&configuredUser.role!=='ADMIN'){
    configuredUser.role='ADMIN';
    Object.assign(configuredUser,hashPassword(adminPassword));
    configuredUser.passwordHash=configuredUser.hash;delete configuredUser.hash;
    await writeUsers(users);
  }

}

async function readJson(filePath, fallback) {
  if (database) {
    const document = await database.collection("lms_storage").findOne({ _id: path.basename(filePath) });
    return document ? document.value : fallback;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  if (database) {
    await database.collection("lms_storage").replaceOne({ _id: path.basename(filePath) }, { value: data }, { upsert: true });
    return;
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (!user || !user.salt) return false;
  const hash = crypto.pbkdf2Sync(password, user.salt, 100000, 64, 'sha512').toString('hex');
  return user.passwordHash === hash;
}

async function getUsers() {
  if (database) return database.collection('users').find({}, { projection:{ _id:0 } }).toArray();
  return (await readJson(USERS_FILE, []));
}

async function writeUsers(users) {
  if (database) {
    await database.collection('users').bulkWrite(users.map(user => ({ updateOne:{ filter:{id:user.id}, update:{$setOnInsert:user}, upsert:true } })));
    return;
  }
  (await writeJson(USERS_FILE, users));
}

async function getSessions() {
  return (await readJson(SESSIONS_FILE, []));
}

async function writeSessions(sessions) {
  (await writeJson(SESSIONS_FILE, sessions));
}

async function getResetTokens() {
  return (await readJson(RESET_TOKENS_FILE, {}));
}

async function writeResetTokens(tokens) {
  (await writeJson(RESET_TOKENS_FILE, tokens));
}

function readRequiredJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

async function getPortalStore() {
  return (await readJson(PORTAL_DATA_FILE, {}));
}

async function getPortalState(userId) {
  const store = database ? null : (await getPortalStore());
  const savedState = database ? (await database.collection('portal_states').findOne({ _id:userId }))?.state || {} : store[userId] || {};
  return {
    skillProgress: { skills: {} },
    internships: [],
    submissions: [],
    hackathonSubmissions: [],
    hackathonEnrollments: [],
    trainingApplications: [],
    ...savedState
  };
}

async function updatePortalState(userId, update) {
  if (database) {
    for (let attempt=0; attempt<5; attempt++) {
      const saved = await database.collection('portal_states').findOne({ _id:userId });
      const state = { skillProgress:{skills:{}}, internships:[], submissions:[], hackathonSubmissions:[], hackathonEnrollments:[], trainingApplications:[], ...saved?.state };
      update(state);
      if (!saved) {
        try { await database.collection('portal_states').insertOne({ _id:userId, version:1, state }); return state; }
        catch (error) { if (error.code === 11000) continue; throw error; }
      }
      const result = await database.collection('portal_states').updateOne({ _id:userId, version:saved.version }, { $set:{state}, $inc:{version:1} });
      if (result.modifiedCount) return state;
    }
    const error = new Error('Your records changed. Please retry.'); error.status=409; throw error;
  }
  const store = (await getPortalStore());
  const state = {
    skillProgress: { skills: {} },
    internships: [],
    submissions: [],
    hackathonSubmissions: [],
    hackathonEnrollments: [],
    trainingApplications: [],
    ...(store[userId] || {})
  };
  update(state);
  store[userId] = state;
  (await writeJson(PORTAL_DATA_FILE, store));
  return state;
}

async function getPortalContent() {
  const content=readRequiredJson(PORTAL_CONTENT_FILE);
  for(const item of await catalogue.list()){
    if(!item.managed||item.type==='jobs')continue;
    const type=item.type==='training'?'courses':'internships';
    content[type]||={};
    const previous=content[type][item.id]||{};
    // Keep curricula and learner records when an offer is unpublished.
    content[type][item.id]={...previous,name:item.title,description:item.description,duration:item.durationMonths+' months',fee:'₹'+item.fee,fees:item.fees,published:item.published,notes:item.notes?item.notes.split('\n').filter(Boolean).map((text,index)=>({title:'Lesson '+(index+1),text})):previous.notes||[],projects:previous.projects||[],resources:previous.resources||[]};
  }
  return content;
}

function createApplicationId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

async function getPaymentApplication(userId, paymentId) {
  const state = (await getPortalState(userId));
  return state.internships.find((item) => item.id === paymentId)
    || state.hackathonEnrollments.find((item) => item.id === paymentId)
    || state.trainingApplications?.find((item) => item.id === paymentId)
    || null;
}

async function addTrainingOrEventApplication(userId, type, itemId) {
  const content = await getPortalContent();
  const item = content[type]?.[itemId];
  if (!item) return null;
  if(item.published===false)return {unavailable:true};

  const feeText = String(item.fee ?? item.price ?? '');
  const freeEvent = type === 'hackathons' && /(?:₹|INR|Rs\.?)\s*0\b.*free/i.test(feeText);
  const feeMatch = feeText.match(/(?:₹|INR|Rs\.?)\s*([\d,]+)/i);
  if (!feeMatch && !freeEvent) return { unavailable: true };

  const noPaymentRequired = freeEvent || Number(feeMatch?.[1].replace(/,/g,'')) === 0;
  const createdAt = new Date().toISOString();
  const application = {
    id: createApplicationId(type === 'hackathons' ? 'event' : 'training'),
    [type === 'hackathons' ? 'event' : 'course']: itemId,
    name: item.name,
    fee: freeEvent ? 0 : Number(feeMatch[1].replace(/,/g, '')),
    status: noPaymentRequired ? 'VERIFIED' : 'AWAITING_PAYMENT',
    ...(noPaymentRequired ? { verifiedAt: createdAt } : {}),
    createdAt
  };

  (await updatePortalState(userId, (state) => {
    const key = type === 'hackathons' ? 'hackathonEnrollments' : 'trainingApplications';
    state[key] ||= [];
    state[key].push(application);
  }));

  return application;
}

function assessmentOpensAt(internship, month) {
  const start = new Date(internship.startedAt || internship.verifiedAt || internship.createdAt);
  if (Number.isNaN(start.getTime())) return null;
  start.setUTCMonth(start.getUTCMonth() + month);
  return start;
}

function getAssessmentQuestions(domain, month) {
  const assessments = readRequiredJson(INTERNSHIP_ASSESSMENTS_FILE);
  return assessments[domain]?.[String(month)] || null;
}

async function getInternshipAssessment(req, res, submit) {
  const id = String((submit ? req.body?.id : req.query.id) || '').trim();
  const month = Number(submit ? req.body?.month : req.query.month);
  const state = (await getPortalState(req.user.id));
  const internship = state.internships.find((item) => item.id === id);
  if (!internship) return res.status(404).json({ error: 'Internship application not found.' });
  if (internship.status !== 'VERIFIED') {
    return res.status(403).json({ error: 'Assessments are available after payment verification.' });
  }
  if (!Number.isInteger(month) || month < 1 || month > internship.months) {
    return res.status(400).json({ error: 'Assessment month is invalid.' });
  }

  const questions = getAssessmentQuestions(internship.domain, month);
  if (!Array.isArray(questions) || !questions.length) {
    return res.status(404).json({ error: 'Assessment questions are not available for this internship month.' });
  }

  const opensAt = assessmentOpensAt(internship, month);
  if (!opensAt || opensAt > new Date()) {
    return res.status(403).json({ error: 'This monthly assessment is not open yet.' });
  }

  if (!submit) {
    return res.json({
      questions: questions.map(({ id: questionId, prompt, options }) => ({ id: questionId, prompt, options }))
    });
  }

  const answers = req.body?.answers;
  if (!Array.isArray(answers) || answers.length !== questions.length
    || answers.some((answer, index) => !Number.isInteger(answer)
      || answer < 0 || answer >= questions[index].options.length)) {
    return res.status(400).json({ error: 'Submit one valid answer for every question.' });
  }

  const score = questions.reduce((total, question, index) => total + (answers[index] === question.correct ? 1 : 0), 0);
  const attempt = { score, passed: score >= Math.ceil(questions.length * 0.7), submittedAt: new Date().toISOString() };
  (await updatePortalState(req.user.id, (userState) => {
    const record = userState.internships.find((item) => item.id === id);
    record.assessments ||= [];
    let assessment = record.assessments.find((item) => item.month === month);
    if (!assessment) {
      assessment = { month, attempts: [] };
      record.assessments.push(assessment);
    }
    assessment.attempts.push(attempt);
  }));
  return res.json(attempt);
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role || 'USER',
    createdAt: user.createdAt
  };
}

async function findUserByEmail(email) {
  const target = normalizeEmail(email);
  if (database) return database.collection('users').findOne({email:target});
  return (await getUsers()).find((user) => normalizeEmail(user.email) === target) || null;
}

async function findUserById(userId) {
  if (database) return database.collection('users').findOne({id:userId});
  return (await getUsers()).find((user) => user.id === userId) || null;
}

function parseCookies(header = '') {
  const cookies = {};
  for (const pair of String(header).split(';')) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) { try { cookies[key] = decodeURIComponent(value); } catch { /* Ignore malformed cookies. */ } }
  }
  return cookies;
}

function sessionCookieOptions(req) {
  const secure = req.secure || process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    path: '/'
  };
}

async function issueSessionCookie(req, res, user) {
  const sessionId = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
  const session = { id:sessionId, userId:user.id, expiresAt };
  if (database) await database.collection('sessions').insertOne(session);
  else { const sessions=await getSessions(); sessions.push(session); await writeSessions(sessions); }
  res.cookie('vypax_session', sessionId, {
    ...sessionCookieOptions(req),
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  return sessionId;
}

function clearSessionCookie(req, res) {
  res.clearCookie('vypax_session', sessionCookieOptions(req));
}

async function getSessionUser(req) {
  const sessionId = parseCookies(req.headers.cookie || '').vypax_session;
  if (!sessionId) return null;

  const session = database ? await database.collection('sessions').findOne({ id:sessionId }) : (await getSessions()).find((item) => item.id === sessionId);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    return null;
  }

  const user = (await findUserById(session.userId));
  return user || null;
}

async function authRequired(req, res, next) {
  const user = (await getSessionUser(req));
  if (!user) {
    return res.status(401).json({ error: 'Please sign in.' });
  }
  req.user = user;
  next();
}

function adminRequired(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Administrator access is required.' });
  }
  next();
}

async function registerUser(req, res) {
  const { name, email, phone, password, consent } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanEmail = normalizeEmail(email);

  if (!cleanName || cleanName.length < 2 || cleanName.length > 100) {
    return res.status(400).json({ error: 'Please provide a valid full name.' });
  }

  if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  if (!password || String(password).length < 8 || String(password).length > 128) {
    return res.status(400).json({ error: 'Password must be between 8 and 128 characters long.' });
  }

  if (![true, 'on', 'Agreed'].includes(consent)) {
    return res.status(400).json({ error: 'You must agree to the account consent statement.' });
  }
  if (!/^[+0-9 ()-]{7,20}$/.test(String(phone || '').trim())) return res.status(400).json({error:'Please provide a valid mobile number.'});

  if ((await findUserByEmail(cleanEmail))) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const users = (await getUsers());
  const { salt, hash } = hashPassword(String(password));
  const user = {
    id: `user_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
    name: cleanName,
    email: cleanEmail,
    phone: String(phone || '').trim(),
    role: 'USER',
    passwordHash: hash,
    salt,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  if (database) {
    try { await database.collection('users').insertOne(user); }
    catch (error) { if (error.code === 11000) return res.status(409).json({error:'An account with this email already exists.'}); throw error; }
  } else (await writeUsers(users));
  (await issueSessionCookie(req, res, user));

  return res.status(201).json({ user: sanitizeUser(user), message: 'Account created successfully.' });
}

function authRouter() {
  const router = express.Router();

  router.post('/register', registerUser);
  router.post('/signup', registerUser);

  router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};
    const cleanEmail = normalizeEmail(email);
    let user = (await findUserByEmail(cleanEmail));

    if (!user || !verifyPassword(String(password || ''), user)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    (await issueSessionCookie(req, res, user));
    return res.json({ user: sanitizeUser(user), message: 'Signed in successfully.' });
  });

  router.post('/logout', async (req, res) => {
    const sessionId = parseCookies(req.headers.cookie || '').vypax_session;
    if (sessionId) {
      if (database) await database.collection('sessions').deleteOne({id:sessionId});
      else { const sessions = (await getSessions()).filter((item) => item.id !== sessionId); await writeSessions(sessions); }
    }
    clearSessionCookie(req, res);
    return res.json({ ok: true, message: 'Signed out.' });
  });

  router.get('/me', async (req, res) => {
    const user = (await getSessionUser(req));
    if (!user) return res.json({ user: null });
    return res.json({ user: sanitizeUser(user) });
  });

  router.post('/forgot', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const token = crypto.randomBytes(24).toString('hex');
    const resets = (await getResetTokens());

    if (email) {
      resets[token] = {
        email,
        createdAt: Date.now()
      };
      (await writeResetTokens(resets));
    }

    return res.json({
      ok: true,
      message: 'If an account exists for that email, you will receive a reset link soon.'
    });
  });

  router.post('/reset', async (req, res) => {
    const { token, password } = req.body || {};
    const resetToken = String(token || '').trim();
    const nextPassword = String(password || '');

    if (!resetToken || nextPassword.length < 8 || nextPassword.length > 128) {
      return res.status(400).json({ error: 'A valid reset token and new password are required.' });
    }

    const resets = (await getResetTokens());
    const resetEntry = resets[resetToken];
    if (!resetEntry || Date.now() - resetEntry.createdAt > 60 * 60 * 1000) {
      return res.status(400).json({ error: 'This reset link is invalid or expired.' });
    }

    const user = (await findUserByEmail(resetEntry.email));
    if (!user) {
      return res.status(400).json({ error: 'This user no longer exists.' });
    }

    const users = (await getUsers());
    const index = users.findIndex((item) => item.id === user.id);
    const { salt, hash } = hashPassword(nextPassword);
    users[index] = {
      ...users[index],
      salt,
      passwordHash: hash
    };
    if (database) await database.collection('users').updateOne({id:user.id}, {$set:{salt,passwordHash:hash}});
    else (await writeUsers(users));
    delete resets[resetToken];
    (await writeResetTokens(resets));

    return res.json({ ok: true, message: 'Password updated successfully. Please sign in.' });
  });

  return router;
}

function paymentRouter() {
  const router = express.Router();
  const uploadMiddleware = multer({ dest: UPLOAD_DIR, limits: { fileSize: 5 * 1024 * 1024 } });

  router.use(authRequired);

  router.get('/panel', async (req, res) => {
    const paymentId = String(req.query.id || '').trim();
    if (!paymentId) return res.status(400).json({ error: 'Payment application id is required.' });
    const application = (await getPaymentApplication(req.user.id, paymentId));
    if (!application) return res.status(404).json({ error: 'Payment application not found.' });
    const upi = process.env.PAYMENT_UPI_ID || 'harshsaini05012004@okaxis';
    const recipient = process.env.PAYMENT_RECIPIENT || 'Harsh Saini';
    const upiUrl = upi ? 'upi://pay?' + new URLSearchParams({ pa: upi, pn: recipient, am: String(application.fee), cu: 'INR', tn: paymentId }) : null;
    return res.json({
      id: paymentId,
      status: application.status,
      title: application.name || 'Learning access payment',
      fee: application.fee,
      feedback: application.feedback || (application.status === 'PENDING' ? 'Payment is awaiting admin verification.' : 'Submit your payment proof after paying.'),
      upi, recipient, upiUrl,
      qrImage: upi === 'harshsaini05012004@okaxis' ? '/site/internship-payment-qr.jpg' : null,
      target: 'portal.html'
    });
  });

  router.post('/event-apply', async (req, res) => {
    const eventId = String(req.body?.event || '').trim();
    if (!eventId) return res.status(400).json({ error: 'Hackathon event id is required.' });
    const application = (await addTrainingOrEventApplication(req.user.id, 'hackathons', eventId));
    if (!application) return res.status(404).json({ error: 'Hackathon event not found.' });
    if (application.unavailable) return res.status(409).json({ error: 'A confirmed event fee is not available yet.' });
    return res.status(201).json({ id: application.id, message: 'Hackathon application created.' });
  });

  router.post('/training-apply', async (req, res) => {
    const courseId = String(req.body?.course || '').trim();
    if (!courseId) return res.status(400).json({ error: 'Course id is required.' });
    const application = (await addTrainingOrEventApplication(req.user.id, 'courses', courseId));
    if (!application) return res.status(404).json({ error: 'Course not found.' });
    if (application.unavailable) return res.status(409).json({ error: 'A confirmed course fee is not available yet.' });
    return res.status(201).json({ id: application.id, message: 'Training application created.' });
  });

  router.post('/proof', async (req, res) => {
    const { id, reference, receiptUploadId } = req.body || {};
    const paymentId = String(id || '').trim();
    const transactionReference = String(reference || '').trim();
    if (!paymentId) return res.status(400).json({ error: 'Payment record id is required.' });
    if (!transactionReference) return res.status(400).json({ error: 'Transaction reference is required.' });
    const application = (await getPaymentApplication(req.user.id, paymentId));
    if (!application) return res.status(404).json({ error: 'Payment application not found.' });

    if (!['AWAITING_PAYMENT', 'REJECTED'].includes(application.status)) return res.status(409).json({ error: 'Payment is already pending review or verified.' });
    if (transactionReference.length > 100) return res.status(400).json({ error: 'Transaction reference must be at most 100 characters.' });
    if (receiptUploadId) {
      if (!/^upload_\d+_[a-f0-9]{12}$/.test(receiptUploadId)) return res.status(400).json({ error: 'Invalid receipt.' });
      const metadata = await readJson(path.join(UPLOAD_DIR, receiptUploadId + '.json'), null);
      if (!metadata || metadata.userId !== req.user.id || metadata.paymentId !== paymentId) return res.status(400).json({ error: 'Receipt does not belong to this payment.' });
    }

    application.paymentProof = {
      reference: transactionReference,
      receiptUploadId: receiptUploadId || null,
      submittedAt: new Date().toISOString()
    };
    application.status = 'PENDING';
    (await updatePortalState(req.user.id, (state) => {
      for (const collection of [state.internships, state.hackathonEnrollments, state.trainingApplications || []]) {
        const record = collection.find((item) => item.id === paymentId);
        if (record) {
          if (!['AWAITING_PAYMENT','REJECTED'].includes(record.status)) { const error = new Error('Payment is already pending or verified.'); error.status=409; throw error; }
          Object.assign(record, application);
        }
      }
    }));
    return res.json({ ok: true, message: 'Payment proof was submitted and is awaiting review.', receiptUploadId: receiptUploadId || null });
  });

  router.post('/receipt-upload', uploadMiddleware.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' });
    const paymentId = String(req.query.id || '');
    const application = await getPaymentApplication(req.user.id, paymentId);
    const bytes = fs.readFileSync(req.file.path);
    const mime = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
      : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP' ? 'image/webp'
      : bytes.subarray(0,5).toString() === '%PDF-' ? 'application/pdf' : null;
    if (!application || !['AWAITING_PAYMENT', 'REJECTED'].includes(application.status) || !mime) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Choose a valid payment and a PNG, JPG, WEBP or PDF receipt.' });
    }
    const uploadId = `upload_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const uploadPath = path.join(UPLOAD_DIR, `${uploadId}.bin`);
    if (database) {
      await database.collection('receipts').insertOne({ _id: uploadId, userId: req.user.id, paymentId, mime, bytes });
      fs.unlinkSync(req.file.path);
    } else fs.renameSync(req.file.path, uploadPath);
    await writeJson(path.join(UPLOAD_DIR, uploadId + '.json'), { userId: req.user.id, paymentId, mime });
    return res.json({ ok: true, uploadId, message: 'Receipt uploaded successfully.' });
  });

  return router;
}

function portalRouter() {
  const router = express.Router();
  const uploadMiddleware = multer({ dest: UPLOAD_DIR, limits: { fileSize: 5 * 1024 * 1024 } });

  router.use(authRequired);

  router.get('/dashboard', async (req, res) => {
    const state = (await getPortalState(req.user.id));
    return res.json({
      skillProgress: state.skillProgress?.skills ? state.skillProgress : { skills: {} },
      internships: (state.internships || []).map((internship) => {
        const savedAssessments = internship.assessments || [];
        return {
          ...internship,
          ...(internship.status !== 'VERIFIED' ? { projects:[], notes:[], resources:[], materials:[] } : {}),
          assessments: Array.from({ length: internship.months }, (_, index) => {
            const month = index + 1;
            const opensAt = assessmentOpensAt(internship, month);
            const saved = savedAssessments.find((assessment) => assessment.month === month);
            return {
              month,
              opensAt: opensAt?.toISOString() || null,
              unlocked: internship.status === 'VERIFIED' && Boolean(opensAt && opensAt <= new Date()),
              attempts: saved?.attempts || []
            };
          })
        };
      }),
      submissions: state.submissions || [],
      hackathonSubmissions: state.hackathonSubmissions || [],
      hackathonEnrollments: state.hackathonEnrollments || []
    });
  });

  router.get('/content', async (req, res) => {
    const type = String(req.query.type || '').trim();
    const id = String(req.query.id || '').trim();
    if (!['courses', 'hackathons', 'internships'].includes(type) || !id) {
      return res.status(400).json({ error: 'A valid content type and id are required.' });
    }

    const content = (await getPortalContent())[type]?.[id];
    if (!content) return res.status(404).json({ error: 'Portal content not found.' });
    const result = { ...content, configuration: content.configuration || {} };
    if(type==='courses'&&Number(String(content.fee||'').replace(/[^\d]/g,''))>0){
      const verified=(await getPortalState(req.user.id)).trainingApplications.some(item=>item.course===id&&item.status==='VERIFIED');
      result.locked=!verified;
      if(!verified){result.notes=[];result.resources=[];result.materials=[];}
    }
    if (type === 'internships') {
      const verified = (await getPortalState(req.user.id)).internships.some(item => item.domain === id && item.status === 'VERIFIED');
      result.locked = !verified;
      if (!verified) { result.projects=[]; result.notes=[]; result.resources=[]; result.materials=[]; }
    }
    if (type === 'hackathons') {
      const publishedEvent = readRequiredJson(HACKATHON_DATA_FILE).events
        .find((event) => event.slug === id);
      if (publishedEvent) {
        result.schedule = publishedEvent.stages?.map(([title, date]) => [title, date]) || [];
        result.awards = publishedEvent.awards?.map(([placement, award]) => `${placement}: ${award}`) || [];
        result.fee = publishedEvent.fee || result.fee;
        result.team = publishedEvent.team || result.team;
        result.description = publishedEvent.description || result.description;
      }
      const enrollment = (await getPortalState(req.user.id)).hackathonEnrollments
        .find((item) => item.event === id && item.status === 'VERIFIED');
      result.locked = !enrollment;
    }
    return res.json(result);
  });

  router.get('/jobs', async (req, res) => {
    return res.json({ jobs: (await catalogue.list()).filter(item=>item.type==='jobs'&&item.published).map(item=>({...item,name:item.title,status:'Applications open',requirements:String(item.requirements||'').split('\n').filter(Boolean)})) });
  });

  router.get('/results', async (req, res) => {
    return res.json({ round1: [], round2: [], winners: [] });
  });

  router.get('/payment-instructions', async (req, res) => {
    return res.json({
      instructions: process.env.PAYMENT_INSTRUCTIONS
        || 'Payment instructions have not been published. Contact Vypax to confirm an approved payment method before paying.'
    });
  });

  router.get('/payment-options', async (req, res) => {
    return res.json({ online: false });
  });

  router.post('/internship', async (req, res) => {
    const domain = String(req.body?.domain || '').trim();
    const months = Number(req.body?.months);
    if (![1, 2, 3, 6].includes(months)) {
      return res.status(400).json({ error: 'Choose a valid internship duration.' });
    }

    const content = (await getPortalContent()).internships?.[domain];
    if (!content) return res.status(404).json({ error: 'Internship domain not found.' });
    if(content.published===false)return res.status(409).json({error:'This internship is not accepting new applications.'});
    const existing = (await getPortalState(req.user.id)).internships.find(item => item.domain === domain && item.months === months && ['AWAITING_PAYMENT','PENDING','REJECTED'].includes(item.status));
    if (existing) return res.json({id:existing.id,message:'Continue with your saved internship application.'});
    const feeByMonths = content.fees || { 1: 499, 2: 999, 3: 1299, 6: 1999 };
    const application = {
      id: createApplicationId('internship'),
      domain,
      name: content.name || domain.replace(/^internship-/, '').replaceAll('-', ' '),
      months,
      fee: feeByMonths[months],
      status: 'AWAITING_PAYMENT',
      feedback: '',
      projects: (content.projects || []).slice(0, months),
      notes: content.notes || [],
      resources: content.resources || [],
      materials: [],
      assessments: [],
      createdAt: new Date().toISOString()
    };
    (await updatePortalState(req.user.id, (state) => {
      state.internships ||= [];
      state.internships.push(application);
    }));
    return res.status(201).json({ id: application.id, message: 'Internship application created.' });
  });

  router.post('/checkout', async (req, res) => {
    return res.status(503).json({ error: 'Online checkout is not configured. Use the published payment instructions.' });
  });

  router.post('/payment-confirm', async (req, res) => {
    return res.status(503).json({ error: 'Online payment verification is not configured.' });
  });

  router.post('/project', async (req, res) => {
    const id = String(req.body?.id || '').trim();
    const month = Number(req.body?.month);
    const url = String(req.body?.url || '').trim();
    const description = String(req.body?.description || '').trim();
    const state = (await getPortalState(req.user.id));
    const internship = state.internships.find((item) => item.id === id);
    if (!internship) return res.status(404).json({ error: 'Internship application not found.' });
    if (internship.status !== 'VERIFIED') return res.status(403).json({ error: 'Project submissions are available after payment verification.' });
    if (!Number.isInteger(month) || month < 1 || month > internship.projects.length) {
      return res.status(400).json({ error: 'Project month is invalid.' });
    }
    if (!url || !description) return res.status(400).json({ error: 'Project link and description are required.' });
    let projectUrl;
    try {
      projectUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Project link must be a valid HTTP or HTTPS URL.' });
    }
    if (!['http:', 'https:'].includes(projectUrl.protocol)) {
      return res.status(400).json({ error: 'Project link must be a valid HTTP or HTTPS URL.' });
    }
    const submission = {
      id: createApplicationId('project'),
      internshipId: id,
      month,
      title: internship.projects[month - 1].title,
      url: projectUrl.href,
      description,
      created_at: new Date().toISOString()
    };
    (await updatePortalState(req.user.id, (userState) => {
      userState.submissions ||= [];
      userState.submissions.push({ data: submission, created_at: submission.created_at });
    }));
    return res.status(201).json({ message: 'Project submission saved.' });
  });

  router.get('/internship-assessment', async (req, res) => {
    return (await getInternshipAssessment(req, res, false));
  });

  router.post('/internship-assessment', async (req, res) => {
    return (await getInternshipAssessment(req, res, true));
  });

  router.get('/certificate', async (req, res) => {
    const id = String(req.query.id || '').trim();
    const internship = (await getPortalState(req.user.id)).internships
      .find((item) => item.status === 'VERIFIED' && item.certificate?.id === id);
    if (!internship) return res.status(404).json({ error: 'Verified internship certificate not found.' });
    const escapeXml = (value) => String(value).replace(/[&<>]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;'
    })[character]);
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
        <rect width="1200" height="800" fill="#f9f9ff"/>
        <text x="600" y="220" text-anchor="middle" font-size="36" font-family="Arial" fill="#1f2937">VYPAX TECHNOLOGIES</text>
        <text x="600" y="300" text-anchor="middle" font-size="56" font-family="Arial" font-weight="700" fill="#0f172a">INTERNSHIP CERTIFICATE</text>
        <text x="600" y="410" text-anchor="middle" font-size="28" font-family="Arial" fill="#374151">This certifies that</text>
        <text x="600" y="470" text-anchor="middle" font-size="42" font-family="Arial" font-weight="700" fill="#111827">${escapeXml(req.user?.name || 'Learner')}</text>
        <text x="600" y="535" text-anchor="middle" font-size="24" font-family="Arial" fill="#374151">has completed the ${escapeXml(internship.domain)} internship track</text>
        <text x="600" y="590" text-anchor="middle" font-size="22" font-family="Arial" fill="#374151">Certificate ID: ${escapeXml(id)}</text>
      </svg>
    `;
    res.type('image/svg+xml');
    return res.send(svg);
  });

  router.post('/hackathon-upload', uploadMiddleware.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' });
    const uploadId = `hackathon_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const uploadPath = path.join(UPLOAD_DIR, `${uploadId}.bin`);
    fs.renameSync(req.file.path, uploadPath);
    return res.json({ ok: true, uploadId, message: 'File uploaded.' });
  });

  router.post('/hackathon', async (req, res) => {
    const { title, description, url, uploadId, event, round } = req.body || {};
    if (!title || !description) {
      return res.status(400).json({ error: 'Project title and description are required.' });
    }
    const eventId = String(event || '').trim();
    if (!(await getPortalContent()).hackathons?.[eventId]) {
      return res.status(404).json({ error: 'Hackathon event not found.' });
    }
    const enrollment = (await getPortalState(req.user.id)).hackathonEnrollments
      .find((item) => item.event === eventId && item.status === 'VERIFIED');
    if (!enrollment) return res.status(403).json({ error: 'A verified event enrollment is required before submitting.' });
    const submittedUploadId = String(uploadId || '').trim();
    if (submittedUploadId
      && (!/^hackathon_\d+_[a-f0-9]{12}$/.test(submittedUploadId)
        || !fs.existsSync(path.join(UPLOAD_DIR, `${submittedUploadId}.bin`)))) {
      return res.status(400).json({ error: 'The uploaded hackathon file could not be found.' });
    }
    const submission = {
      id: createApplicationId('hackathon'),
      title: String(title).trim(),
      description: String(description).trim(),
      url: String(url || '').trim(),
      uploadId: submittedUploadId || null,
      event: eventId,
      round: String(round || '').trim(),
      created_at: new Date().toISOString()
    };
    (await updatePortalState(req.user.id, (state) => {
      state.hackathonSubmissions ||= [];
      state.hackathonSubmissions.push({ data: submission, created_at: submission.created_at });
    }));
    return res.status(201).json({ ok: true, message: `Hackathon submission saved for ${eventId} (${submission.round || 'round'}).` });
  });

  return router;
}

function adminRouter() {
  const router = express.Router();
  router.use(authRequired, adminRequired);
  catalogue.mountAdmin(router);

  router.get('/payments', async (req, res) => {
    const payments = [];
    for (const user of await getUsers()) {
      const state = await getPortalState(user.id);
      for (const application of [...state.internships, ...state.hackathonEnrollments, ...state.trainingApplications]) {
        payments.push({ ...application, userId: user.id, learner: { name: user.name, email: user.email } });
      }
    }
    return res.json({ payments });
  });

  router.get('/receipts/:id', async (req, res) => {
    const id = req.params.id;
    if (!/^upload_\d+_[a-f0-9]{12}$/.test(id)) return res.status(404).json({ error: 'Receipt not found.' });
    const metadata = await readJson(path.join(UPLOAD_DIR, id + '.json'), null);
    if (!metadata) return res.status(404).json({ error: 'Receipt not found.' });
    res.set('Cache-Control', 'no-store');
    res.set('Content-Disposition', 'attachment; filename="receipt.' + ({ 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'application/pdf':'pdf' })[metadata.mime] + '"');
    res.type(metadata.mime);
    if (database) {
      const receipt = await database.collection('receipts').findOne({ _id: id });
      if (!receipt) return res.status(404).json({ error: 'Receipt not found.' });
      return res.send(Buffer.from(receipt.bytes.buffer));
    }
    return res.sendFile(path.resolve(UPLOAD_DIR, id + '.bin'));
  });

  router.post('/payments/review', async (req, res) => {
    const { userId, id, decision } = req.body || {};
    const feedback = String(req.body?.feedback || '').trim();
    if (typeof userId !== 'string' || typeof id !== 'string' || !userId || !id) return res.status(400).json({error:'Learner and payment IDs are required.'});
    if (!['VERIFIED', 'REJECTED'].includes(decision) || feedback.length > 1000 || (decision === 'REJECTED' && !feedback)) return res.status(400).json({ error: 'Choose approve or reject and give a reason for rejection.' });
    const application = await getPaymentApplication(userId, id);
    if (!application) return res.status(404).json({ error: 'Payment not found.' });
    if (application.status !== 'PENDING' || !application.paymentProof?.reference) return res.status(409).json({ error: 'Only submitted payments awaiting review can be reviewed.' });
    await updatePortalState(userId, state => {
      const record = [...state.internships, ...state.hackathonEnrollments, ...state.trainingApplications].find(item => item.id === id);
      if (record.status !== 'PENDING') { const error = new Error('This payment was already reviewed.'); error.status=409; throw error; }
      record.status = decision;
      record.feedback = feedback;
      record.reviewedBy = req.user.id;
      record.reviewedAt = new Date().toISOString();
      if (decision === 'VERIFIED') { record.verifiedAt = record.reviewedAt; record.startedAt = record.reviewedAt; }
      record.reviewHistory ||= [];
      record.reviewHistory.push({ decision, feedback, by: req.user.id, at: record.reviewedAt });
    });
    return res.json({ ok: true, message: decision === 'VERIFIED' ? 'Payment approved. Learner access is unlocked.' : 'Payment rejected. The learner can resubmit proof.' });
  });

  router.get('/overview', async (req, res) => {
    const users = (await getUsers())
      .filter((user) => user.role !== 'ADMIN')
      .map((user) => ({
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }));

    return res.json({
      admin: sanitizeUser(req.user),
      totalLearners: users.length,
      openPositions: (await catalogue.list()).filter(item=>item.type==='jobs'&&item.published).length,
      learners: users
    });
  });

  return router;
}

module.exports = {
  getCatalogue: catalogue.list,
  catalogueRouter: catalogue.publicRouter,
  authRouter,
  portalRouter,
  adminRouter,
  paymentRouter,
  connectDatabase: async () => {
    if (process.env.MONGODB_URI) {
      mongoClient = new MongoClient(process.env.MONGODB_URI);
      await mongoClient.connect();
      database = mongoClient.db(process.env.MONGODB_DATABASE || 'vypax_lms');
      await database.command({ ping: 1 });
      await database.collection('users').createIndex({email:1}, {unique:true});
      await database.collection('users').createIndex({id:1}, {unique:true});
      await database.collection('sessions').createIndex({id:1}, {unique:true});
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error('MONGODB_URI is required in production.');
    }
    await ensureStorage();
    return Boolean(database);
  },
  getDatabase: () => database
};
