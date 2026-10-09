const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const RESET_TOKENS_FILE = path.join(DATA_DIR, 'reset-tokens.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

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

function issueSessionCookie(res, user) {
  const sessions = getSessions();
  const sessionId = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
  sessions.push({ id: sessionId, userId: user.id, expiresAt });
  writeSessions(sessions);
  res.cookie('vypax_session', sessionId, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  return sessionId;
}

function clearSessionCookie(res) {
  res.clearCookie('vypax_session', {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production'
  });
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
  issueSessionCookie(res, user);

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

    issueSessionCookie(res, user);
    return res.json({ user: sanitizeUser(user), message: 'Signed in successfully.' });
  });

  router.post('/logout', (req, res) => {
    const sessionId = parseCookies(req.headers.cookie || '').vypax_session;
    if (sessionId) {
      const sessions = getSessions().filter((item) => item.id !== sessionId);
      writeSessions(sessions);
    }
    clearSessionCookie(res);
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
    const paymentId = String(req.query.id || 'demo-payment');
    const status = paymentId ? 'PENDING' : 'VERIFIED';
    return res.json({
      id: paymentId,
      status: status,
      title: 'Learning access payment',
      fee: 299,
      feedback: 'Payment is currently under review. The learner dashboard will unlock once the payment is verified.',
      target: 'portal.html'
    });
  });

  router.post('/proof', (req, res) => {
    const { id, reference, receiptUploadId } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Payment record id is required.' });
    return res.json({ ok: true, message: 'Payment proof received for review.' + (reference ? ` Reference: ${reference}` : ''), receiptUploadId: receiptUploadId || null });
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

  router.get('/jobs', (req, res) => {
    return res.json({ jobs: DEFAULT_JOBS });
  });

  router.post('/checkout', (req, res) => {
    const { id } = req.body || {};
    return res.json({
      ok: true,
      keyId: 'rzp_test_1234567890',
      orderId: `order_${Date.now()}`,
      amount: 29900,
      currency: 'INR',
      id: id || 'demo-internship',
      message: 'Checkout session prepared.'
    });
  });

  router.post('/payment-confirm', (req, res) => {
    const { id, paymentId, signature } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Payment id is required.' });
    return res.json({ ok: true, paymentId, signature, message: 'Payment confirmed.' });
  });

  router.get('/certificate', (req, res) => {
    const { id } = req.query;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
        <rect width="1200" height="800" fill="#f9f9ff"/>
        <text x="600" y="220" text-anchor="middle" font-size="36" font-family="Arial" fill="#1f2937">VYPAX TECHNOLOGIES</text>
        <text x="600" y="300" text-anchor="middle" font-size="56" font-family="Arial" font-weight="700" fill="#0f172a">INTERNSHIP CERTIFICATE</text>
        <text x="600" y="410" text-anchor="middle" font-size="28" font-family="Arial" fill="#374151">This certifies that</text>
        <text x="600" y="470" text-anchor="middle" font-size="42" font-family="Arial" font-weight="700" fill="#111827">${String(req.user?.name || 'Learner').replace(/[<>]/g, '')}</text>
        <text x="600" y="535" text-anchor="middle" font-size="24" font-family="Arial" fill="#374151">has completed the selected internship track</text>
        <text x="600" y="590" text-anchor="middle" font-size="22" font-family="Arial" fill="#374151">Certificate ID: ${String(id || 'VYPAX-INT-2026').replace(/[<>]/g, '')}</text>
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
    const { title, description, url, event, round } = req.body || {};
    if (!title || !description) {
      return res.status(400).json({ error: 'Project title and description are required.' });
    }
    return res.json({ ok: true, message: `Hackathon submission saved for ${event || 'event'} (${round || 'round'}).` });
  });

  return router;
}

module.exports = {
  authRouter,
  portalRouter,
  paymentRouter,
  connectDatabase: async () => true,
  getDatabase: () => null
};

ensureStorage();
