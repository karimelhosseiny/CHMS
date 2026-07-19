const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role, studentId: user.studentId },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

async function register(req, res) {
  const { email, password, name, studentId } = req.body;
  if (!email || !password || !name || !studentId) {
    res.status(400).json({ error: 'BadRequest', message: 'email, password, name, and studentId are required' });
    return;
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    res.status(409).json({ error: 'Conflict', message: 'An account with this email already exists' });
    return;
  }

  let student = await Student.findOne({ studentId });
  if (!student) {
    student = await Student.create({ studentId, name });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash, role: 'student', studentId });

  res.status(201).json({ token: signToken(user), user: { email: user.email, role: user.role, studentId } });
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'BadRequest', message: 'email and password are required' });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !passwordMatches) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
    return;
  }

  res.json({ token: signToken(user), user: { email: user.email, role: user.role, studentId: user.studentId } });
}

module.exports = { register, login };
