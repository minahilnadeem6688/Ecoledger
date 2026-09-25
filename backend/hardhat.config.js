/**
 * Networks
 *   localhost: `npm run chain` then `npm run deploy`
 *   sepolia:   set SEPOLIA_RPC_URL and OWNER_PRIVATE_KEY in .env, then `npm run deploy:sepolia`
 */
require('dotenv').config();
require('@nomicfoundation/hardhat-toolbox');

const { SEPOLIA_RPC_URL, OWNER_PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

module.exports = {
  solidity: {
    version: '0.8.20',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
    sepolia: {
      url: SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
      accounts: OWNER_PRIVATE_KEY ? [OWNER_PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY || '',
  },
  sourcify: { enabled: false },
};
