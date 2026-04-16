const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const File = require('../models/File');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + uuidv4() + path.extname(file.originalname))
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Only JPG, PNG, and PDF are allowed.'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/files/upload
router.post('/upload', auth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).json({ message: 'File too large. Max size is 5MB.' });
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    try {
      const saved = await File.create({
        userId: req.user.id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        size: req.file.size,
        mimeType: req.file.mimetype
      });
      res.status(201).json({ message: 'File uploaded successfully', file: saved });
    } catch (e) {
      res.status(500).json({ message: 'Failed to save file metadata.' });
    }
  });
});

// GET /api/files
router.get('/', auth, async (req, res) => {
  try {
    const files = await File.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(files);
  } catch {
    res.status(500).json({ message: 'Failed to fetch files.' });
  }
});

// GET /api/files/download/:id  — MUST be before /:id
router.get('/download/:id', auth, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, userId: req.user.id });
    if (!file) return res.status(404).json({ message: 'File not found.' });
    res.download(file.filePath, file.originalName, (err) => {
      if (err && !res.headersSent) res.status(500).json({ message: 'Download failed.' });
    });
  } catch {
    res.status(500).json({ message: 'Server error during download.' });
  }
});

// DELETE /api/files/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, userId: req.user.id });
    if (!file) return res.status(404).json({ message: 'File not found.' });

    fs.unlink(file.filePath, async (err) => {
      if (err && err.code !== 'ENOENT') return res.status(500).json({ message: 'Could not delete file.' });
      await file.deleteOne();
      res.json({ message: 'File deleted successfully.' });
    });
  } catch {
    res.status(500).json({ message: 'Server error during delete.' });
  }
});

module.exports = router;
