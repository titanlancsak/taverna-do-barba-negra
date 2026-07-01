const express = require('express');
const multer = require('multer');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });
const CONVERTED_DIR = path.join(__dirname, '..', 'converted');

const allowedFormats = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'];

router.post('/convert', upload.single('audio'), (req, res) => {
  const { format } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  if (!allowedFormats.includes(format)) {
    return res.status(400).json({ error: 'Invalid format requested' });
  }

  const inputPath = req.file.path;
  const outputFilename = `${Date.now()}.${format}`;
  const outputPath = path.join(CONVERTED_DIR, outputFilename);

  execFile('ffmpeg', ['-i', inputPath, outputPath], (err, stdout, stderr) => {
    fs.unlinkSync(inputPath); // limpa o original independente do resultado

    if (err) {
      console.error(stderr);
      return res.status(500).json({ error: 'Conversion failed' });
    }

    res.download(outputPath, outputFilename, (downloadErr) => {
      if (!downloadErr) {
        fs.unlinkSync(outputPath);
      }
    });
  });
});

module.exports = router;
