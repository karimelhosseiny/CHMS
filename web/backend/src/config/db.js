const mongoose = require('mongoose');

async function connectDB(uri) {
  await mongoose.connect(uri);
  return mongoose.connection;
}

function redactCredentials(uri) {
  return uri.replace(/\/\/[^@]+@/, '//<redacted>@');
}

module.exports = { connectDB, redactCredentials };
