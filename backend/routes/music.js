const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const MUSIC_DIR = path.join(__dirname, '..', '..', 'frontend', 'assets', 'music');

router.get('/list', (req, res) => {
  fs.readdir(MUSIC_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Could not read music folder' });
    }

    const tracks = files
      .filter(f => f.toLowerCase().endsWith('.mp3'))
      .map(f => ({
        title: path.basename(f, '.mp3').replace(/[-_]/g, ' '),
        file: f
      }));

    res.json(tracks);
  });
});

module.exports = router;
