'use strict';

const path = require('path');
const express = require('express');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.disable('x-powered-by');
app.use(compression());

// Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Static files: long cache for media, short cache for HTML
app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (/\.(html|css|js)$/i.test(filePath)) {
        // always revalidate (ETag) so updates show up right after deploy
        res.setHeader('Cache-Control', 'no-cache');
      } else if (/\.(jpe?g|png|webp|avif|gif|svg|mp4|webm)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    },
  })
);

app.get('/healthz', (req, res) => res.json({ ok: true }));

// 404 -> home page
app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Website đang chạy tại http://localhost:${PORT}`);
});
