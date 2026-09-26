/**
 * EcoLedger API as a normal server
 *   npm run chain    →  local blockchain (terminal 1)
 *   npm run deploy   →  deploy the CCT token (terminal 2, once per chain start)
 *   npm start        →  this server on http://localhost:5000 (terminal 3)
 * Production settings are listed in .env.example and docs/DEPLOYMENT.md.
 */
const app = require('./app');
const blockchain = require('./config/blockchain');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('JWT_SECRET must be set in production. Refusing to start.');
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 5000;

app.ready()
  .catch((err) => console.error('MongoDB connection failed:', err.message))
  .finally(async () => {
    app.listen(PORT, '0.0.0.0', () => console.log(`EcoLedger API on http://localhost:${PORT}`));
    const chain = await blockchain.status();
    console.log(chain.contract ? `Blockchain ready: CCT at ${chain.address}` : `Blockchain not ready: ${chain.reason}`);
  });
