const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configuração do multer (armazena upload temporário)
const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

router.post('/convert', upload.single('image'), async (req, res) => {
  try {
    const { format } = req.body; // 'png', 'jpeg', ou 'gif'
    const allowedFormats = ['png', 'jpeg', 'gif'];

    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    if (!allowedFormats.includes(format)) {
      return res.status(400).json({ error: 'Invalid format requested' });
    }

    const inputPath = req.file.path;
    const outputFilename = `${Date.now()}.${format}`;
    const outputPath = path.join(__dirname, '..', 'converted', outputFilename);

    await sharp(inputPath).toFormat(format).toFile(outputPath);

    // Remove o arquivo original após conversão
    fs.unlinkSync(inputPath);

    res.download(outputPath, outputFilename, (err) => {
      if (!err) {
        fs.unlinkSync(outputPath); // limpa depois de enviar
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Conversion failed' });
  }
});

module.exports = router;
