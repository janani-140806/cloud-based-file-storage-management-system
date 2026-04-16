const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

// Email & password validation helpers
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isStrongPassword = (pw) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(pw);

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ message: "All fields are required" });
  if (!isValidEmail(email))
    return res.status(400).json({ message: "Invalid email format" });
  if (!isStrongPassword(password))
    return res.status(400).json({
      message:
        "Password must be 8+ chars with uppercase, lowercase, number & special character",
    });

  try {
    if (await User.findOne({ email }))
      return res.status(409).json({ message: "User already exists with this email" });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, password: hashed });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({ token, username: user.username, message: "Registration successful" });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Invalid email or password" });

    const token = jwt.sign({ id: user._id, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token, username: user.username, message: "Login successful" });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});

module.exports = router;
