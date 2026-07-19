require('dotenv').config();
const createApp = require('./app');
const { connectDB, redactCredentials } = require('./config/db');

const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chms';

async function main() {
  await connectDB(MONGODB_URI);
  console.log(`Connected to MongoDB at ${redactCredentials(MONGODB_URI)}`);

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`CHMS backend listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
