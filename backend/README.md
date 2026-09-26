# EcoLedger backend

Express 5 + MongoDB API and the `EcoToken` (CCT) ERC-20 contract.
See the [main README](../README.md) for the full picture and [DEPLOYMENT.md](../docs/DEPLOYMENT.md) to put it online.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the API on `PORT` (default 5000) via `server.js` |
| `npm run dev` | Start the API and restart on file changes |
| `npm run chain` | Local Hardhat blockchain on `127.0.0.1:8545` |
| `npm run deploy` | Deploy CCT to the local chain (writes `deployments/localhost.json`) |
| `npm run deploy:sepolia` | Deploy CCT to Sepolia (needs `OWNER_PRIVATE_KEY` with test ETH) |
| `npm test` | Contract tests |
| `npm run smoke [-- <api-url>]` | End-to-end check against a running API |

The Express app is in `app.js`. `server.js` runs it as a normal server; `api/index.js` runs it as a
Vercel serverless function (settings in `vercel.json`).

Configuration lives in `.env`; every option is described in [`.env.example`](.env.example).
Locally nothing is required.

## Endpoints

All routes are under `/api`. Signed-in routes need `Authorization: Bearer <token>`.

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | anyone | Server, database and chain status (with the reason when something is down) |
| POST | `/students/register` | anyone | Create a student account; a wallet address is generated |
| POST | `/students/login` | anyone | Returns a token and the user |
| GET | `/students/me` | signed in | Current user |
| GET | `/students/wallet` | signed in | On-chain balance, recorded tokens, mint receipts |
| POST | `/students/wallet` | signed in | Use your own wallet address `{ walletAddress }` |
| GET | `/students/leaderboard` | anyone | Students ranked by CCT minted |
| DELETE | `/students/:id` | admin | Remove a student and their data (e.g. test accounts) |
| GET | `/activity-types` | anyone | Activity types and their points |
| POST | `/activity-types` | admin | Add an activity type |
| POST | `/activity` | student | Submit an activity (multipart: `activityType`, `description`, `location`, `proofImage`) |
| GET | `/activity/mine` | student | Own activities |
| GET | `/activity?status=` | admin | All activities, optionally by status |
| POST | `/activity/:id/verify` | admin | `{ status: "approved" \| "rejected", reason? }`; approval mints CCT |
| POST | `/activity/:id/retry-mint` | admin | Retry a mint that failed |
| GET | `/proofs/:key` | anyone with the link | Proof photo (random 32-character key) |
| GET | `/rewards` | anyone | Rewards |
| POST | `/rewards` | admin | Add a reward |
| GET | `/rewards/mine` | signed in | Own redemptions |
| POST | `/rewards/:id/redeem` | student | Spend eco points on a reward |

## How minting works

1. `POST /activity/:id/verify` claims the activity only if it is still pending, so it can't be approved twice.
2. Eco points are added to the student.
3. `config/blockchain.js` calls `reward(wallet, points, activityId)` on the contract and waits for the receipt.
4. The transaction hash and block number are saved on the activity (`mintStatus: "minted"`).
   If anything fails (chain offline, no gas, wrong key), `mintStatus` becomes `"failed"` with a readable
   `mintError`, and `/retry-mint` tries again later.

## Contract

[`contracts/EcoToken.sol`](contracts/EcoToken.sol): OpenZeppelin ERC-20 + Ownable, named
*Campus Carbon Token* (`CCT`), 0 decimals so 1 point = 1 token. Only the owner (the API's key) can mint.
`reward()` emits `EcoReward(student, amount, activityId)`, so every token can be traced to the activity
that earned it. Tests are in [`test/EcoToken.test.js`](test/EcoToken.test.js).
