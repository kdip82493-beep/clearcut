
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const FormData = require('form-data');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());

const REMOVE_BG_KEY = 'gf88iGyp3Ba4hVZ3W1KrUnWX';
const SUPABASE_URL = 'https://slaqdzscvtwmqlyjhdzz.supabase.co';
const SUPABASE_KEY = 'sb_secret_tV7Bc3KvLWQ0lX2TJdYAPw_n2O5_2k3';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function supaFetch(method, path, body) {
  return new Promise(function(resolve, reject) {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'slaqdzscvtwmqlyjhdzz.supabase.co',
      path: '/rest/v1/' + path,
      method: method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(options, function(r) {
      let b = '';
      r.on('data', function(c) { b += c; });
      r.on('end', function() {
        try { resolve({ status: r.statusCode, data: JSON.parse(b) }); }
        catch(e) { resolve({ status: r.statusCode, data: b }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function authFetch(path, body) {
  return new Promise(function(resolve, reject) {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'slaqdzscvtwmqlyjhdzz.supabase.co',
      path: '/auth/v1/' + path,
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, function(r) {
      let b = '';
      r.on('data', function(c) { b += c; });
      r.on('end', function() {
        try { resolve({ status: r.statusCode, data: JSON.parse(b) }); }
        catch(e) { resolve({ status: r.statusCode, data: b }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getUser(token) {
  return new Promise(function(resolve, reject) {
    const options = {
      hostname: 'slaqdzscvtwmqlyjhdzz.supabase.co',
      path: '/auth/v1/user',
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + token
      }
    };
    const req = https.request(options, function(r) {
      let b = '';
      r.on('data', function(c) { b += c; });
      r.on('end', function() {
        try { resolve({ status: r.statusCode, data: JSON.parse(b) }); }
        catch(e) { resolve({ status: r.statusCode, data: b }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

app.get('/', function(req, res) { res.json({ status: 'ok', message: 'ClearCut Server Live!' }); });
app.get('/health', function(req, res) { res.json({ status: 'ok' }); });

app.post('/auth/register', async function(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email aur password daalo' });
    const r = await authFetch('signup', { email, password });
    if (r.status !== 200 && r.status !== 201) return res.status(400).json({ error: 'Registration fail hua. Email already use mein hai.' });
    const uid = r.data.user?.id;
    if (uid) {
      await supaFetch('POST', 'users', {
        id: uid, email: email, plan: 'free',
        images_used_today: 0, images_used_month: 0,
        last_reset_date: new Date().toDateString()
      });
    }
    res.json({ success: true, message: 'Account ban gaya! Ab login karein.' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/auth/login', async function(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email aur password daalo' });
    const r = await authFetch('token?grant_type=password', { email, password });
    if (r.status !== 200) return res.status(400).json({ error: 'Email ya password galat hai!' });
    const uid = r.data.user?.id;
    const uInfo = await supaFetch('GET', 'users?id=eq.' + uid + '&select=*', null);
    const ud = uInfo.data[0] || { plan: 'free', images_used_today: 0, images_used_month: 0 };
    res.json({
      success: true,
      token: r.data.access_token,
      user: { id: uid, email: r.data.user?.email, plan: ud.plan, images_used_today: ud.images_used_today, images_used_month: ud.images_used_month }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/user/info', async function(req, res) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Login karein pehle' });
    const ur = await getUser(token);
    if (ur.status !== 200) return res.status(401).json({ error: 'Invalid session' });
    const uid = ur.data.id;
    const uInfo = await supaFetch('GET', 'users?id=eq.' + uid + '&select=*', null);
    const ud = uInfo.data[0] || { plan: 'free', images_used_today: 0, images_used_month: 0 };
    const today = new Date().toDateString();
    if (ud.last_reset_date !== today) {
      await supaFetch('PATCH', 'users?id=eq.' + uid, { images_used_today: 0, last_reset_date: today });
      ud.images_used_today = 0;
    }
    res.json({ id: uid, email: ur.data.email, plan: ud.plan, images_used_today: ud.images_used_today, images_used_month: ud.images_used_month });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/remove-bg', upload.single('image'), async function(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image nahi mili' });
    const token = req.headers.authorization?.replace('Bearer ', '');
    let uid = null, plan = 'free', usedToday = 0;
    if (token) {
      const ur = await getUser(token);
      if (ur.status === 200) {
        uid = ur.data.id;
        const uInfo = await supaFetch('GET', 'users?id=eq.' + uid + '&select=*', null);
        const ud = uInfo.data[0] || {};
        plan = ud.plan || 'free';
        usedToday = ud.images_used_today || 0;
        const today = new Date().toDateString();
        if (ud.last_reset_date !== today) {
          usedToday = 0;
          await supaFetch('PATCH', 'users?id=eq.' + uid, { images_used_today: 0, last_reset_date: today });
        }
        if (plan === 'free' && usedToday >= 3) {
          return res.status(429).json({ error: 'Free plan limit khatam! Aaj 3 images use ho gayi. Kal dobara aao ya Pro lo!', upgrade: true });
        }
      }
    }
    const fd = new FormData();
    fd.append('image_file', req.file.buffer, { filename: 'image.png', contentType: req.file.mimetype });
    fd.append('size', 'auto');
    const bgRes = await new Promise(function(resolve, reject) {
      const opts = { hostname: 'api.remove.bg', path: '/v1.0/removebg', method: 'POST', headers: Object.assign({ 'X-Api-Key': REMOVE_BG_KEY }, fd.getHeaders()) };
      const r2 = https.request(opts, function(r) {
        const chunks = [];
        r.on('data', function(c) { chunks.push(c); });
        r.on('end', function() { resolve({ status: r.statusCode, buffer: Buffer.concat(chunks) }); });
      });
      r2.on('error', reject);
      fd.pipe(r2);
    });
    if (bgRes.status === 402) return res.status(402).json({ error: 'API credits khatam!' });
    if (bgRes.status !== 200) return res.status(bgRes.status).json({ error: 'Remove.bg error: ' + bgRes.status });
    if (uid) await supaFetch('PATCH', 'users?id=eq.' + uid, { images_used_today: usedToday + 1, images_used_month: usedToday + 1 });
    res.set('Content-Type', 'image/png');
    res.set('Access-Control-Allow-Origin', '*');
    res.send(bgRes.buffer);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/stats', async function(req, res) {
  try {
    if (req.headers['x-admin-key'] !== 'clearcut_admin_2024') return res.status(403).json({ error: 'Access denied' });
    const r = await supaFetch('GET', 'users?select=*', null);
    const users = r.data || [];
    res.json({
      total_users: users.length,
      free_users: users.filter(function(u) { return u.plan === 'free'; }).length,
      pro_users: users.filter(function(u) { return u.plan === 'pro'; }).length,
      images_today: users.reduce(function(s, u) { return s + (u.images_used_today || 0); }, 0),
      recent: users.slice(-5)
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log('ClearCut running on port ' + PORT); });

