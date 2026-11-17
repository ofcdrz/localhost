require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;
const SECRET = process.env.JWT_SECRET || 'dev-only-change-this-secret';
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const users = new Map();
const contacts = new Map();
const activity = new Map();
const callRecords = new Map();
const lastCallByContact = new Map();
const userCallTimes = new Map();

function makeToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try {
    req.user = jwt.verify(token, SECRET);
    if (!users.has(req.user.id)) throw new Error('User not found');
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in again.' });
  }
}
function seedDemo(userId) {
  contacts.set(userId, [
    { id: crypto.randomUUID(), name: 'Aarav Mehta', phone: '+91 98765 43210', consent: false, channel: '—' },
    { id: crypto.randomUUID(), name: 'Sara Khan', phone: '+91 98111 22334', consent: false, channel: '—' },
    { id: crypto.randomUUID(), name: 'Kabir Shah', phone: '+91 98990 11223', consent: false, channel: '—' },
    { id: crypto.randomUUID(), name: 'Mira Joshi', phone: '+91 97654 32109', consent: false, channel: '—' }
  ]);
  activity.set(userId, [
    { id: crypto.randomUUID(), type: 'SMS notification', target: 'Aarav Mehta', status: 'Delivered', date: new Date(Date.now()-1000*60*18).toISOString() },
    { id: crypto.randomUUID(), type: 'Call reminder', target: 'Sara Khan', status: 'Completed', date: new Date(Date.now()-1000*60*60*2).toISOString() },
    { id: crypto.randomUUID(), type: 'SMS notification', target: 'Mira Joshi', status: 'Delivered', date: new Date(Date.now()-1000*60*60*5).toISOString() }
  ]);
}
app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'GlassConnect API' }));

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Name, valid email and password (8+ characters) are required.' });
  }
  const normalized = String(email).trim().toLowerCase();
  if ([...users.values()].some(u => u.email === normalized)) return res.status(409).json({ error: 'Email already registered.' });
  const user = { id: crypto.randomUUID(), name: String(name).trim(), email: normalized, password: await bcrypt.hash(password, 12) };
  users.set(user.id, user); seedDemo(user.id);
  res.status(201).json({ token: makeToken(user), user: { id: user.id, name: user.name, email: user.email } });
});
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const user = [...users.values()].find(u => u.email === email);
  if (!user || !(await bcrypt.compare(String(req.body?.password || ''), user.password))) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  if (!contacts.has(user.id)) seedDemo(user.id);
  res.json({ token: makeToken(user), user: { id: user.id, name: user.name, email: user.email } });
});
app.get('/api/me', auth, (req, res) => {
  const u = users.get(req.user.id);
  res.json({ id: u.id, name: u.name, email: u.email });
});
app.get('/api/contacts', auth, (req, res) => res.json(contacts.get(req.user.id) || []));
app.post('/api/contacts', auth, (req, res) => {
  const { name, phone, consent } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required.' });
  const list = contacts.get(req.user.id) || [];
  const item = { id: crypto.randomUUID(), name: String(name).trim(), phone: String(phone).trim(), consent: consent === true, channel: '—' };
  list.unshift(item); contacts.set(req.user.id, list); res.status(201).json(item);
});
app.patch('/api/contacts/:id/consent', auth, (req, res) => {
  const list = contacts.get(req.user.id) || [];
  const item = list.find(c => c.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Contact not found.' });
  item.consent = req.body?.consent === true;
  res.json(item);
});
app.delete('/api/contacts/:id', auth, (req, res) => {
  contacts.set(req.user.id, (contacts.get(req.user.id) || []).filter(c => c.id !== req.params.id));
  res.status(204).end();
});
// Safe demo endpoint: records an opted-in notification/reminder only. No calls or SMS are sent.
app.post('/api/notifications/preview', auth, (req, res) => {
  const { contactId, message, channel } = req.body || {};
  const contact = (contacts.get(req.user.id) || []).find(c => c.id === contactId);
  if (!contact) return res.status(404).json({ error: 'Contact not found.' });
  if (!contact.consent) return res.status(403).json({ error: 'This contact has not opted in. No notification was created.' });
  if (!message || String(message).length > 500) return res.status(400).json({ error: 'Message is required (maximum 500 characters).' });
  const entry = { id: crypto.randomUUID(), type: `${channel === 'Call' ? 'Call reminder' : 'SMS notification'} (preview)`, target: contact.name, status: 'Preview only', date: new Date().toISOString() };
  const list = activity.get(req.user.id) || [];
  list.unshift(entry); activity.set(req.user.id, list.slice(0, 50));
  res.status(201).json({ entry, note: 'Preview saved. No call or SMS was sent.' });
});
// Real click-to-call: Exotel calls the workspace owner's verified phone first,
// then bridges the opted-in contact after the owner answers. One contact per request.
app.post('/api/calls', auth, async (req, res) => {
  const { contactId, confirmConsent } = req.body || {};
  const contact = (contacts.get(req.user.id) || []).find(c => c.id === contactId);
  if (!contact) return res.status(404).json({ error: 'Contact not found.' });
  if (!contact.consent || confirmConsent !== true) {
    return res.status(403).json({ error: 'A verified opt-in and explicit confirmation are required. No call was placed.' });
  }
  const normalize = value => String(value || '').replace(/[\s()-]/g, '');
  const to = normalize(contact.phone);
  const agent = normalize(process.env.EXOTEL_AGENT_NUMBER);
  const exophone = normalize(process.env.EXOTEL_CALLER_ID);
  if (!/^\+91[6-9]\d{9}$/.test(to)) return res.status(400).json({ error: 'Contact must have a valid Indian mobile number in +91XXXXXXXXXX format.' });
  if (!/^\+91[6-9]\d{9}$/.test(agent) || !/^\d{8,15}$/.test(exophone)) {
    return res.status(503).json({ error: 'Calling is not configured. Set EXOTEL_AGENT_NUMBER and EXOTEL_CALLER_ID in the server .env file.' });
  }
  const required = ['EXOTEL_ACCOUNT_SID', 'EXOTEL_API_KEY', 'EXOTEL_API_TOKEN'];
  if (required.some(k => !process.env[k])) return res.status(503).json({ error: 'Exotel credentials are missing from the server .env file.' });

  const now = Date.now();
  const key = `${req.user.id}:${contact.id}`;
  const last = lastCallByContact.get(key) || 0;
  if (now - last < 10 * 60 * 1000) return res.status(429).json({ error: 'This contact was called recently. Wait at least 10 minutes before trying again.' });
  const recent = (userCallTimes.get(req.user.id) || []).filter(t => now - t < 60 * 60 * 1000);
  if (recent.length >= 3) return res.status(429).json({ error: 'Hourly safety limit reached (3 calls). Try again later.' });

  const accountSid = process.env.EXOTEL_ACCOUNT_SID;
  const form = new URLSearchParams({ From: agent, To: to, CallerId: exophone, TimeLimit: '180' });
  if (process.env.PUBLIC_API_URL) {
    form.set('StatusCallback', `${process.env.PUBLIC_API_URL.replace(/\/$/, '')}/api/calls/status`);
    form.append('StatusCallbackEvents[]', 'terminal');
  }
  try {
    const response = await fetch(`https://api.in.exotel.com/v1/Accounts/${encodeURIComponent(accountSid)}/Calls/connect`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.EXOTEL_API_KEY}:${process.env.EXOTEL_API_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString(),
      signal: AbortSignal.timeout(20000)
    });
    const raw = await response.text();
    if (!response.ok) {
      console.error('Exotel call request failed:', response.status, raw.slice(0, 500));
      return res.status(502).json({ error: 'Exotel could not start the call. Check your account, caller ID and API permissions.' });
    }
    let payload = {};
    try { payload = JSON.parse(raw); } catch { payload = { raw }; }
    const call = payload.Call || payload.call || {};
    const record = {
      id: crypto.randomUUID(), callSid: call.Sid || call.sid || null,
      contactId: contact.id, target: contact.name, phone: contact.phone,
      status: call.Status || call.status || 'initiated', date: new Date().toISOString()
    };
    callRecords.set(record.callSid || record.id, record);
    lastCallByContact.set(key, now);
    userCallTimes.set(req.user.id, [...recent, now]);
    const list = activity.get(req.user.id) || [];
    list.unshift({ id: record.id, type: 'Outbound call', target: contact.name, status: record.status, date: record.date });
    activity.set(req.user.id, list.slice(0, 50));
    contact.channel = 'Call';
    res.status(202).json({ message: 'Call request accepted. Exotel will ring your verified phone first; after you answer, it will call and connect the opted-in contact.', call: record });
  } catch (error) {
    console.error('Exotel request error:', error.message);
    res.status(502).json({ error: 'Could not reach Exotel. Please try again later.' });
  }
});

// Exotel terminal status callback. Only updates a call SID already created by this app.
app.post('/api/calls/status', (req, res) => {
  const sid = req.body?.CallSid || req.body?.call_sid || req.body?.Sid;
  const status = req.body?.Status || req.body?.status;
  if (sid && callRecords.has(String(sid))) {
    const record = callRecords.get(String(sid));
    record.status = String(status || record.status).toLowerCase();
    record.updatedAt = new Date().toISOString();
    for (const list of activity.values()) {
      const entry = list.find(item => item.id === record.id);
      if (entry) entry.status = record.status;
    }
  }
  res.sendStatus(200);
});

app.get('/api/activity', auth, (req, res) => res.json(activity.get(req.user.id) || []));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});
app.listen(PORT, () => console.log(`GlassConnect API running on http://localhost:${PORT}`));
