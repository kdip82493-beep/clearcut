const express = require('express');
const multer = require('multer');
const cors = require('cors');
const FormData = require('form-data');

const app = express();
app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

app.get('/', function(req, res) {
  res.send('ClearCut Server is Live!');
});

app.get('/health', function(req, res) {
  res.json({ status: 'ok' });
});

app.post('/remove-bg', upload.single('image'), function(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  const https = require('https');
  const API_KEY = 'gf88iGyp3Ba4hVZ3W1KrUnWX';

  const formData = new FormData();
  formData.append('image_file', req.file.buffer, {
    filename: 'image.png',
    contentType: req.file.mimetype
  });
  formData.append('size', 'auto');

  const headers = Object.assign({
    'X-Api-Key': API_KEY
  }, formData.getHeaders());

  const options = {
    hostname: 'api.remove.bg',
    path: '/v1.0/removebg',
    method: 'POST',
    headers: headers
  };

  const request = https.request(options, function(response) {
    const chunks = [];
    response.on('data', function(chunk) { chunks.push(chunk); });
    response.on('end', function() {
      const buffer = Buffer.concat(chunks);
      if (response.statusCode === 200) {
        res.set('Content-Type', 'image/png');
        res.set('Access-Control-Allow-Origin', '*');
        res.send(buffer);
      } else {
        res.status(response.statusCode).json({
          error: 'API error: ' + response.statusCode
        });
      }
    });
  });

  request.on('error', function(err) {
    res.status(500).json({ error: err.message });
  });

  formData.pipe(request);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('ClearCut running on port ' + PORT);
});
