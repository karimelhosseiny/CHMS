const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const sectionRoutes = require('./routes/sections');
const enrollmentRoutes = require('./routes/enrollments');
const studentRoutes = require('./routes/students');
const adminRoutes = require('./routes/admin');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/sections', sectionRoutes);
  app.use('/api/enrollments', enrollmentRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/admin', adminRoutes);

  app.use((req, res) => res.status(404).json({ error: 'NotFound', message: 'Route not found' }));
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
