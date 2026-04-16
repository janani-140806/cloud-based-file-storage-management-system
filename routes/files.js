const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const File = require("../models/File");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Multer storage config — unique filename with uuid
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

// File filter — only PDF, JPG, PNG
const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "application/pdf"];
  allowed.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error("Only PDF, JPG, and PNG files are allowed"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// All routes below require authentication
router.use(authMiddleware);

// POST /api/files/upload
router.post("/upload", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE")
      return res.status(400).json({ message: "File size exceeds 5MB limit" });
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    try {
      const fileDoc = await File.create({
        userId:       req.user.id,
        originalName: req.file.originalname,
        filename:     req.file.filename,
        filepath:     req.file.path,
        mimetype:     req.file.mimetype,
        size:         req.file.size,
      });
      res.status(201).json({ message: "File uploaded successfully", file: fileDoc });
    } catch {
      res.status(500).json({ message: "Failed to save file metadata" });
    }
  });
});

// GET /api/files — list files for logged-in user
router.get("/", async (req, res) => {
  try {
    const files = await File.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(files);
  } catch {
    res.status(500).json({ message: "Failed to fetch files" });
  }
});

// GET /api/files/download/:id
router.get("/download/:id", async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, userId: req.user.id });
    if (!file) return res.status(404).json({ message: "File not found" });
    res.download(file.filepath, file.originalName);
  } catch {
    res.status(500).json({ message: "Download failed" });
  }
});

// DELETE /api/files/:id
router.delete("/:id", async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, userId: req.user.id });
    if (!file) return res.status(404).json({ message: "File not found" });

    // Remove physical file
    if (fs.existsSync(file.filepath)) fs.unlinkSync(file.filepath);

    await file.deleteOne();
    res.json({ message: "File deleted successfully" });
  } catch {
    res.status(500).json({ message: "Delete failed" });
  }
});

module.exports = router;
