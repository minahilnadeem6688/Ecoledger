# EcoLedger API

Express 5 + MongoDB API and the `EcoToken` (CCT) ERC-20 contract. See the
[main README](../README.md) for the full setup.

```bash
npm install
npm run chain     # local Hardhat node on :8545
npm run deploy    # deploy CCT, writes deployments/localhost.json
npm start         # API on :5000
```

## Endpoints

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | anyone | server, database and chain status |
| POST | `/api/students/register` | anyone | create a student account (wallet created automatically) |
| POST | `/api/students/login` | anyone | returns a JWT |
| GET | `/api/students/me` | signed in | current user |
| GET | `/api/students/wallet` | student | on-chain balance, recorded tokens, mint receipts |
| POST | `/api/students/wallet` | student | use your own wallet address |
| GET | `/api/students/leaderboard` | signed in | ranked by CCT minted |
| GET | `/api/activity-types` | anyone | activity types and their points |
| POST | `/api/activity` | student | submit an activity (multipart, `proofImage`) |
| GET | `/api/activity/mine` | student | own activities |
| GET | `/api/activity?status=` | admin | all activities |
| POST | `/api/activity/:id/verify` | admin | `{ status: "approved" \| "rejected", reason? }`, approval mints CCT |
| POST | `/api/activity/:id/retry-mint` | admin | retry a failed mint |
| GET | `/api/rewards` | anyone | rewards |
| GET | `/api/rewards/mine` | student | own redemptions |
| POST | `/api/rewards/:id/redeem` | student | spend eco points |

## Contract

`contracts/EcoToken.sol`: OpenZeppelin ERC-20 + Ownable, 0 decimals.
`reward(to, amount, activityId)` is owner-only and emits
`EcoReward(student, amount, activityId)`, so every mint can be traced back to the
activity that earned it.
