const pool = require('../../db/pool');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PROFILE_PICS_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'assets', 'profile-pictures');

async function updateProfile(req, res) {
  try {
    const { displayName, isAnonymous, course, gender } = req.body;
    const userId = req.user.userId;

    if (displayName && displayName.length > 50) {
      return res.status(400).json({ error: 'Display name too long (max 50 characters)' });
    }

    if (course && course.length > 100) {
      return res.status(400).json({ error: 'Course name too long' });
    }

    await pool.query(
      `UPDATE users
       SET display_name = $1, is_anonymous = $2, course = $3, gender = $4, updated_at = NOW()
       WHERE id = $5`,
      [displayName || null, !!isAnonymous, course || null, gender || null, userId]
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

async function uploadProfilePicture(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const userId = req.user.userId;
    const inputPath = req.file.path;

    // Valida que o conteúdo real do arquivo é uma imagem (não confia na extensão)
    let metadata;
    try {
      metadata = await sharp(inputPath).metadata();
    } catch (err) {
      fs.unlinkSync(inputPath);
      return res.status(400).json({ error: 'File is not a valid image' });
    }

    const allowedFormats = ['jpeg', 'png', 'webp'];
    if (!allowedFormats.includes(metadata.format)) {
      fs.unlinkSync(inputPath);
      return res.status(400).json({ error: 'Only JPEG, PNG, or WEBP images are allowed' });
    }

    // Gera nome de arquivo aleatório e reprocessa a imagem (remove metadados, redimensiona, recomprime)
    const filename = `${crypto.randomBytes(16).toString('hex')}.webp`;
    const outputPath = path.join(PROFILE_PICS_DIR, filename);

    await sharp(inputPath)
      .resize(400, 400, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(outputPath);

    fs.unlinkSync(inputPath);

    // Remove a foto antiga, se existir
    const oldPicResult = await pool.query('SELECT profile_picture_url FROM users WHERE id = $1', [userId]);
    const oldPicUrl = oldPicResult.rows[0]?.profile_picture_url;
    if (oldPicUrl) {
      const oldFilePath = path.join(PROFILE_PICS_DIR, path.basename(oldPicUrl));
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    const publicUrl = `/assets/profile-pictures/${filename}`;
    await pool.query('UPDATE users SET profile_picture_url = $1, updated_at = NOW() WHERE id = $2', [publicUrl, userId]);

    res.json({ message: 'Profile picture updated', profilePictureUrl: publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
}

module.exports = { updateProfile, uploadProfilePicture };
