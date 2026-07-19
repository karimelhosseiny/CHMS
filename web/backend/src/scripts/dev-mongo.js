const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

const DATA_DIR = path.join(__dirname, '..', '..', '.mongo-data');
const PORT = Number(process.env.MONGO_DEV_PORT) || 27017;

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  console.log(`Starting local MongoDB on port ${PORT}, data dir: ${DATA_DIR}`);
  console.log('(First start may take a while while the engine initializes — subsequent starts are faster.)');

  const mongod = await MongoMemoryServer.create({
    instance: {
      port: PORT,
      ip: '127.0.0.1',
      dbPath: DATA_DIR,
      storageEngine: 'wiredTiger',
      launchTimeout: 120000,
    },
  });

  console.log(`MongoDB is running at: ${mongod.getUri()}`);
  console.log('Data persists in .mongo-data/ between restarts. Press Ctrl+C to stop.');

  const shutdown = async () => {
    console.log('\nStopping MongoDB...');
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start local MongoDB:', err);
  process.exit(1);
});
