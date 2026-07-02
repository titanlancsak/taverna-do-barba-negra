const express = require('express');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const router = express.Router();
const { heavyLimiter } = require('../middleware/rateLimiters');

// Detecta o caminho do yt-dlp dependendo do ambiente (Mac local vs VM Linux)
function findYtDlpPath() {
  const possiblePaths = [
    '/opt/homebrew/bin/yt-dlp', // Mac (Apple Silicon, Homebrew)
    '/usr/local/bin/yt-dlp',    // Mac (Intel, Homebrew) ou VM Linux (pip)
    '/usr/bin/yt-dlp'           // Linux (instalação via pacote de sistema)
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }

  return 'yt-dlp'; // fallback: confia no PATH do sistema
}

const YT_DLP_PATH = findYtDlpPath();
const DOWNLOAD_DIR = path.join(__dirname, '..', 'converted');

router.post('/fetch', heavyLimiter, (req, res) => {
  const { url, type } = req.body;

  if (!url || typeof url !== 'string' || url.length > 2000) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: 'Only http/https URLs are allowed' });
  }

  const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
  const hostname = parsedUrl.hostname.toLowerCase();
  const isPrivateIp = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/.test(hostname);

  if (blockedHosts.includes(hostname) || isPrivateIp || hostname.endsWith('.local')) {
    return res.status(400).json({ error: 'This URL is not allowed' });
  }

  if (!['video', 'audio'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type. Use "video" or "audio".' });
  }

  const id = crypto.randomBytes(6).toString('hex');
  const outputTemplate = path.join(DOWNLOAD_DIR, `${id}.%(ext)s`);

  const args = type === 'audio'
    ? ['-x', '--audio-format', 'mp3', '-o', outputTemplate, url]
    : ['-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4', '-o', outputTemplate, url];

  execFile(YT_DLP_PATH, args, { timeout: 120000 }, (err, stdout, stderr) => {
    if (err) {
      console.error(stderr);
      return res.status(500).json({ error: 'Download failed. Check the URL and try again.' });
    }

    const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(id));
    if (!files.length) {
      return res.status(500).json({ error: 'File not found after download.' });
    }

    const filePath = path.join(DOWNLOAD_DIR, files[0]);

    res.download(filePath, files[0], (downloadErr) => {
      if (!downloadErr) {
        fs.unlinkSync(filePath);
      }
    });
  });
});

module.exports = router;
