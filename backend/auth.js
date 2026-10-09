const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const RESET_TOKENS_FILE = path.join(DATA_DIR, 'reset-tokens.json');
const PORTAL_DATA_FILE = path.join(DATA_DIR, 'portal-data.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_SITE_DIR = path.join(__dirname, '..', 'frontend', 'public', 'site');
const PORTAL_CONTENT_FILE = path.join(PUBLIC_SITE_DIR, 'portal-content.json');
const HACKATHON_DATA_FILE = path.join(PUBLIC_SITE_DIR, 'hackathons-data.json');
const INTERNSHIP_ASSESSMENTS_FILE = path.join(PUBLIC_SITE_DIR, 'internship-assessments.json');

const DEFAULT_ADMIN_EMAIL = 'admin@vypaxtechnologies.com';
const DEFAULT_ADMIN_PASSWORD = 'Vypax@Admin2026!';

function getConfiguredAdminCredentials() {
  return {
    email: normalizeEmail(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL),
    password: String(process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD)
  };
}
const DEFAULT_JOBS = [
  { id: 'business-development-executive', name: 'Business Development Executive', description: 'Generate opportunities and grow learner and business relationships.', location: 'Bengaluru / Remote', status: 'Applications open', requirements: ['Strong communication', 'Sales focus', 'CRM comfort'] },
  { id: 'lead-generation-executive', name: 'Lead Generation Executive', description: 'Identify qualified leads and support funnel growth for student and corporate programmes.', location: 'Remote', status: 'Applications open', requirements: ['Research and outreach', 'Email and phone outreach', 'Good follow-up discipline'] },
  { id: 'hr-intern', name: 'HR Intern', description: 'Support recruitment coordination, onboarding, and learner engagement workflows.', location: 'Bengaluru', status: 'Internship', requirements: ['Organised and patient', 'Professional communication', 'Documentation skills'] }
];

function ensureStorage() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const users = readJson(USERS_FILE, []);
  const { email: adminEmail, password: adminPassword } = getConfiguredAdminCredentials();

  if (!users.some((user) => normalizeEmail(user.email) === adminEmail)) {
    const { salt, hash } = hashPassword(adminPassword);
    users.push({
      id: 'admin-user',
      name: 'Vypax Administrator',
      email: adminEmail,
      phone: '+91 0000000000',
      role: 'ADMIN',
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString()
    });
    writeJson(USERS_FILE, users);
  }

  if (!fs.existsSync(SESSIONS_FILE)) writeJson(SESSIONS_FILE, []);
  if (!fs.existsSync(RESET_TOKENS_FILE)) writeJson(RESET_TOKENS_FILE, {});
  if (!fs.existsSync(PORTAL_DATA_FILE)) writeJson(PORTAL_DATA_FILE, {});
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, data) {
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

function getUsers() {
  ensureStorage();
  return readJson(USERS_FILE, []);
}

function writeUsers(users) {
  writeJson(USERS_FILE, users);
}

function getSessions() {
  ensureStorage();
  return readJson(SESSIONS_FILE, []);
}

function writeSessions(sessions) {
  writeJson(SESSIONS_FILE, sessions);
}

function getResetTokens() {
  ensureStorage();
  return readJson(RESET_TOKENS_FILE, {});
}

function writeResetTokens(tokens) {
  writeJson(RESET_TOKENS_FILE, tokens);
}

function readRequiredJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getPortalStore() {
  return readJson(PORTAL_DATA_FILE, {});
}

function getPortalState(userId) {
  const store = getPortalStore();
  const savedState = store[userId] || {};
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

function updatePortalState(userId, update) {
  const store = getPortalStore();
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
  writeJson(PORTAL_DATA_FILE, store);
  return state;
}

function getPortalContent() {
  return readRequiredJson(PORTAL_CONTENT_FILE);
}

function createApplicationId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function getPaymentApplication(userId, paymentId) {
  const state = getPortalState(userId);
  return state.internships.find((item) => item.id === paymentId)
    || state.hackathonEnrollments.find((item) => item.id === paymentId)
    || state.trainingApplications?.find((item) => item.id === paymentId)
    || null;
}

function addTrainingOrEventApplication(userId, type, itemId) {
  const content = getPortalContent();
  const item = content[type]?.[itemId];
  if (!item) return null;

  const feeText = String(item.fee ?? item.price ?? '');
  const freeEvent = type === 'hackathons' && /(?:₹|INR|Rs\.?)\s*0\b.*free/i.test(feeText);
  const feeMatch = feeText.match(/(?:₹|INR|Rs\.?)\s*([\d,]+)/i);
  if (!feeMatch && !freeEvent) return { unavailable: true };

  const createdAt = new Date().toISOString();
  const application = {
    id: createApplicationId(type === 'hackathons' ? 'event' : 'training'),
    [type === 'hackathons' ? 'event' : 'course']: itemId,
    name: item.name,
    fee: freeEvent ? 0 : Number(feeMatch[1].replace(/,/g, '')),
    status: freeEvent ? 'VERIFIED' : 'AWAITING_PAYMENT',
    ...(freeEvent ? { verifiedAt: createdAt } : {}),
    createdAt
  };

  updatePortalState(userId, (state) => {
    const key = type === 'hackathons' ? 'hackathonEnrollments' : 'trainingApplications';
    state[key] ||= [];
    state[key].push(application);
  });

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

function getInternshipAssessment(req, res, submit) {
  const id = String((submit ? req.body?.id : req.query.id) || '').trim();
  const month = Number(submit ? req.body?.month : req.query.month);
  const state = getPortalState(req.user.id);
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
  updatePortalState(req.user.id, (userState) => {
    const record = userState.internships.find((item) => item.id === id);
    record.assessments ||= [];
    let assessment = record.assessments.find((item) => item.month === month);
    if (!assessment) {
      assessment = { month, attempts: [] };
      record.assessments.push(assessment);
    }
    assessment.attempts.push(attempt);
  });
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

function findUserByEmail(email) {
  const target = normalizeEmail(email);
  return getUsers().find((user) => normalizeEmail(user.email) === target) || null;
}

function findUserById(userId) {
  return getUsers().find((user) => user.id === userId) || null;
}

function parseCookies(header = '') {
  const cookies = {};
  for (const pair of String(header).split(';')) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
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

function issueSessionCookie(req, res, user) {
  const sessions = getSessions();
  const sessionId = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
  sessions.push({ id: sessionId, userId: user.id, expiresAt });
  writeSessions(sessions);
  res.cookie('vypax_session', sessionId, {
    ...sessionCookieOptions(req),
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  return sessionId;
}

function clearSessionCookie(req, res) {
  res.clearCookie('vypax_session', sessionCookieOptions(req));
}

function getSessionUser(req) {
  const sessionId = parseCookies(req.headers.cookie || '').vypax_session;
  if (!sessionId) return null;

  const sessions = getSessions();
  const session = sessions.find((item) => item.id === sessionId);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    const remaining = sessions.filter((item) => item.id !== sessionId);
    writeSessions(remaining);
    return null;
  }

  const user = findUserById(session.userId);
  return user || null;
}

function authRequired(req, res, next) {
  const user = getSessionUser(req);
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

function registerUser(req, res) {
  const { name, email, phone, password, consent } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanEmail = normalizeEmail(email);

  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ error: 'Please provide a valid full name.' });
  }

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  if (!password || String(password).length < 12) {
    return res.status(400).json({ error: 'Password must be at least 12 characters long.' });
  }

  if (consent === false || consent === 'false') {
    return res.status(400).json({ error: 'You must agree to the account consent statement.' });
  }

  if (findUserByEmail(cleanEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const users = getUsers();
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
  writeUsers(users);
  issueSessionCookie(req, res, user);

  return res.status(201).json({ user: sanitizeUser(user), message: 'Account created successfully.' });
}

function authRouter() {
  const router = express.Router();

  router.post('/register', registerUser);
  router.post('/signup', registerUser);

  router.post('/login', (req, res) => {
    const { email, password } = req.body || {};
    const cleanEmail = normalizeEmail(email);
    const { email: adminEmail, password: adminPassword } = getConfiguredAdminCredentials();
    let user = findUserByEmail(cleanEmail);

    if (cleanEmail === adminEmail && String(password || '') === adminPassword) {
      user = user || getUsers().find((item) => normalizeEmail(item.email) === adminEmail) || null;
      if (!user) {
        const adminHash = hashPassword(adminPassword);
        const adminUser = {
          id: 'admin-user',
          name: 'Vypax Administrator',
          email: adminEmail,
          phone: '+91 0000000000',
          role: 'ADMIN',
          passwordHash: adminHash.hash,
          salt: adminHash.salt,
          createdAt: new Date().toISOString()
        };
        const users = getUsers();
        users.push(adminUser);
        writeUsers(users);
        user = adminUser;
      }
    }

    if (!user || !verifyPassword(String(password || ''), user)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    issueSessionCookie(req, res, user);
    return res.json({ user: sanitizeUser(user), message: 'Signed in successfully.' });
  });

  router.post('/logout', (req, res) => {
    const sessionId = parseCookies(req.headers.cookie || '').vypax_session;
    if (sessionId) {
      const sessions = getSessions().filter((item) => item.id !== sessionId);
      writeSessions(sessions);
    }
    clearSessionCookie(req, res);
    return res.json({ ok: true, message: 'Signed out.' });
  });

  router.get('/me', (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.json({ user: null });
    return res.json({ user: sanitizeUser(user) });
  });

  router.post('/forgot', (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const token = crypto.randomBytes(24).toString('hex');
    const resets = getResetTokens();

    if (email) {
      resets[token] = {
        email,
        createdAt: Date.now()
      };
      writeResetTokens(resets);
    }

    return res.json({
      ok: true,
      message: 'If an account exists for that email, you will receive a reset link soon.'
    });
  });

  router.post('/reset', (req, res) => {
    const { token, password } = req.body || {};
    const resetToken = String(token || '').trim();
    const nextPassword = String(password || '');

    if (!resetToken || nextPassword.length < 12) {
      return res.status(400).json({ error: 'A valid reset token and new password are required.' });
    }

    const resets = getResetTokens();
    const resetEntry = resets[resetToken];
    if (!resetEntry) {
      return res.status(400).json({ error: 'This reset link is invalid or expired.' });
    }

    const user = findUserByEmail(resetEntry.email);
    if (!user) {
      return res.status(400).json({ error: 'This user no longer exists.' });
    }

    const users = getUsers();
    const index = users.findIndex((item) => item.id === user.id);
    const { salt, hash } = hashPassword(nextPassword);
    users[index] = {
      ...users[index],
      salt,
      passwordHash: hash
    };
    writeUsers(users);
    delete resets[resetToken];
    writeResetTokens(resets);

    return res.json({ ok: true, message: 'Password updated successfully. Please sign in.' });
  });

  return router;
}

function paymentRouter() {
  const router = express.Router();
  const uploadMiddleware = multer({ dest: UPLOAD_DIR, limits: { fileSize: 5 * 1024 * 1024 } });

  router.use(authRequired);

  router.get('/panel', (req, res) => {
    const paymentId = String(req.query.id || '').trim();
    if (!paymentId) return res.status(400).json({ error: 'Payment application id is required.' });
    const application = getPaymentApplication(req.user.id, paymentId);
    if (!application) return res.status(404).json({ error: 'Payment application not found.' });
    return res.json({
      id: paymentId,
      status: application.status,
      title: application.name || 'Learning access payment',
      fee: application.fee,
      feedback: application.feedback || 'Payment is awaiting review. Access will be updated after verification.',
      target: 'portal.html'
    });
  });

  router.post('/event-apply', (req, res) => {
    const eventId = String(req.body?.event || '').trim();
    if (!eventId) return res.status(400).json({ error: 'Hackathon event id is required.' });
    const application = addTrainingOrEventApplication(req.user.id, 'hackathons', eventId);
    if (!application) return res.status(404).json({ error: 'Hackathon event not found.' });
    if (application.unavailable) return res.status(409).json({ error: 'A confirmed event fee is not available yet.' });
    return res.status(201).json({ id: application.id, message: 'Hackathon application created.' });
  });

  router.post('/training-apply', (req, res) => {
    const courseId = String(req.body?.course || '').trim();
    if (!courseId) return res.status(400).json({ error: 'Course id is required.' });
    const application = addTrainingOrEventApplication(req.user.id, 'courses', courseId);
    if (!application) return res.status(404).json({ error: 'Course not found.' });
    if (application.unavailable) return res.status(409).json({ error: 'A confirmed course fee is not available yet.' });
    return res.status(201).json({ id: application.id, message: 'Training application created.' });
  });

  router.post('/proof', (req, res) => {
    const { id, reference, receiptUploadId } = req.body || {};
    const paymentId = String(id || '').trim();
    const transactionReference = String(reference || '').trim();
    if (!paymentId) return res.status(400).json({ error: 'Payment record id is required.' });
    if (!transactionReference) return res.status(400).json({ error: 'Transaction reference is required.' });
    const application = getPaymentApplication(req.user.id, paymentId);
    if (!application) return res.status(404).json({ error: 'Payment application not found.' });

    application.paymentProof = {
      reference: transactionReference,
      receiptUploadId: receiptUploadId || null,
      submittedAt: new Date().toISOString()
    };
    application.status = 'PENDING';
    updatePortalState(req.user.id, (state) => {
      for (const collection of [state.internships, state.hackathonEnrollments, state.trainingApplications || []]) {
        const record = collection.find((item) => item.id === paymentId);
        if (record) Object.assign(record, application);
      }
    });
    return res.json({ ok: true, message: 'Payment proof was submitted and is awaiting review.', receiptUploadId: receiptUploadId || null });
  });

  router.post('/receipt-upload', uploadMiddleware.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' });
    const uploadId = `upload_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const uploadPath = path.join(UPLOAD_DIR, `${uploadId}.bin`);
    fs.renameSync(req.file.path, uploadPath);
    return res.json({ ok: true, uploadId, message: 'Receipt uploaded successfully.' });
  });

  return router;
}

function portalRouter() {
  const router = express.Router();
  const uploadMiddleware = multer({ dest: UPLOAD_DIR, limits: { fileSize: 5 * 1024 * 1024 } });

  router.use(authRequired);

  router.get('/dashboard', (req, res) => {
    const state = getPortalState(req.user.id);
    return res.json({
      skillProgress: state.skillProgress?.skills ? state.skillProgress : { skills: {} },
      internships: (state.internships || []).map((internship) => {
        const savedAssessments = internship.assessments || [];
        return {
          ...internship,
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

  router.get('/content', (req, res) => {
    const type = String(req.query.type || '').trim();
    const id = String(req.query.id || '').trim();
    if (!['courses', 'hackathons', 'internships'].includes(type) || !id) {
      return res.status(400).json({ error: 'A valid content type and id are required.' });
    }

    const content = getPortalContent()[type]?.[id];
    if (!content) return res.status(404).json({ error: 'Portal content not found.' });
    const result = { ...content, configuration: content.configuration || {} };
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
      const enrollment = getPortalState(req.user.id).hackathonEnrollments
        .find((item) => item.event === id && item.status === 'VERIFIED');
      result.locked = !enrollment;
    }
    return res.json(result);
  });

  router.get('/jobs', (req, res) => {
    return res.json({ jobs: DEFAULT_JOBS });
  });

  router.get('/results', (req, res) => {
    return res.json({ round1: [], round2: [], winners: [] });
  });

  router.get('/payment-instructions', (req, res) => {
    return res.json({
      instructions: process.env.PAYMENT_INSTRUCTIONS
        || 'Payment instructions have not been published. Contact Vypax to confirm an approved payment method before paying.'
    });
  });

  router.get('/payment-options', (req, res) => {
    return res.json({ online: false });
  });

  router.post('/internship', (req, res) => {
    const domain = String(req.body?.domain || '').trim();
    const months = Number(req.body?.months);
    if (![1, 2, 3, 6].includes(months)) {
      return res.status(400).json({ error: 'Choose a valid internship duration.' });
    }

    const content = getPortalContent().internships?.[domain];
    if (!content) return res.status(404).json({ error: 'Internship domain not found.' });
    const feeByMonths = { 1: 499, 2: 999, 3: 1299, 6: 1999 };
    const application = {
      id: createApplicationId('internship'),
      domain,
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
    updatePortalState(req.user.id, (state) => {
      state.internships ||= [];
      state.internships.push(application);
    });
    return res.status(201).json({ id: application.id, message: 'Internship application created.' });
  });

  router.post('/checkout', (req, res) => {
    return res.status(503).json({ error: 'Online checkout is not configured. Use the published payment instructions.' });
  });

  router.post('/payment-confirm', (req, res) => {
    return res.status(503).json({ error: 'Online payment verification is not configured.' });
  });

  router.post('/project', (req, res) => {
    const id = String(req.body?.id || '').trim();
    const month = Number(req.body?.month);
    const url = String(req.body?.url || '').trim();
    const description = String(req.body?.description || '').trim();
    const state = getPortalState(req.user.id);
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
    updatePortalState(req.user.id, (userState) => {
      userState.submissions ||= [];
      userState.submissions.push({ data: submission, created_at: submission.created_at });
    });
    return res.status(201).json({ message: 'Project submission saved.' });
  });

  router.get('/internship-assessment', (req, res) => {
    return getInternshipAssessment(req, res, false);
  });

  router.post('/internship-assessment', (req, res) => {
    return getInternshipAssessment(req, res, true);
  });

  router.get('/certificate', (req, res) => {
    const id = String(req.query.id || '').trim();
    const internship = getPortalState(req.user.id).internships
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

  router.post('/hackathon-upload', uploadMiddleware.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' });
    const uploadId = `hackathon_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const uploadPath = path.join(UPLOAD_DIR, `${uploadId}.bin`);
    fs.renameSync(req.file.path, uploadPath);
    return res.json({ ok: true, uploadId, message: 'File uploaded.' });
  });

  router.post('/hackathon', (req, res) => {
    const { title, description, url, uploadId, event, round } = req.body || {};
    if (!title || !description) {
      return res.status(400).json({ error: 'Project title and description are required.' });
    }
    const eventId = String(event || '').trim();
    if (!getPortalContent().hackathons?.[eventId]) {
      return res.status(404).json({ error: 'Hackathon event not found.' });
    }
    const enrollment = getPortalState(req.user.id).hackathonEnrollments
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
    updatePortalState(req.user.id, (state) => {
      state.hackathonSubmissions ||= [];
      state.hackathonSubmissions.push({ data: submission, created_at: submission.created_at });
    });
    return res.status(201).json({ ok: true, message: `Hackathon submission saved for ${eventId} (${submission.round || 'round'}).` });
  });

  return router;
}

function adminRouter() {
  const router = express.Router();
  router.use(authRequired, adminRequired);

  router.get('/overview', (req, res) => {
    const users = getUsers()
      .filter((user) => user.role !== 'ADMIN')
      .map((user) => ({
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }));

    return res.json({
      admin: sanitizeUser(req.user),
      totalLearners: users.length,
      openPositions: DEFAULT_JOBS.length,
      learners: users
    });
  });

  return router;
}

module.exports = {
  authRouter,
  portalRouter,
  adminRouter,
  paymentRouter,
  connectDatabase: async () => true,
  getDatabase: () => null
};

ensureStorage();
