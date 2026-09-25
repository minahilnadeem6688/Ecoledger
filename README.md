# EcoLedger

A campus rewards ledger for environmental work. Students log eco-actions with a
photo, an admin verifies them, and every approval mints the same number of
**Campus Carbon Tokens (CCT)** to the student's wallet on an Ethereum chain.
Eco points can then be spent on campus rewards.

| Folder | What it is |
| --- | --- |
| `ecoledger/` | Node.js + Express API, MongoDB (Mongoose), JWT auth, and the `EcoToken` ERC-20 contract (Hardhat) |
| `ecoledger-app/` | Expo / React Native app that runs on the web, Android and iOS |

## How it works

1. A student registers. A wallet address is created for them (they can switch to their own, e.g. MetaMask).
2. They log an activity: type, description, location and a proof photo. Points are set by the server from the activity type, never by the client.
3. An admin reviews the proof and approves or rejects it with a reason.
4. On approval the API credits the points and calls `EcoToken.reward(student, amount, activityId)`. The transaction hash and block number are stored on the activity and shown to both the admin and the student.
5. If the chain is down, the approval still goes through, the mint is marked as failed with the reason, and the admin can retry it later.
6. The wallet screen reads the balance live from the contract (`balanceOf`), next to EcoLedger's own record.
7. If the API is unreachable when a student submits, the activity is saved on the device and sent automatically when the server is back.

## Run it locally

You need Node.js 20+ and MongoDB running on `127.0.0.1:27017`.

```bash
# 1. API and blockchain
cd ecoledger
npm install
cp .env.example .env          # optional, defaults work for local use
npm run chain                 # terminal 1: local Hardhat chain on :8545
npm run deploy                # terminal 2: deploys the CCT token (run again whenever the chain restarts)
npm start                     # terminal 2: API on http://localhost:5000

# 2. App
cd ../ecoledger-app
npm install
npm run web                   # opens in the browser; or `npx expo start` for Expo Go
```

The app finds the API on its own: on the web it uses the same host on port 5000,
and in Expo Go it uses the computer running `expo start`. To point it elsewhere,
set `EXPO_PUBLIC_API_URL` (for example `http://192.168.1.20:5000/api`).

**Admin login (created on first start):** `admin@ecoledger.dev` / `admin123`.
Change it with `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `ecoledger/.env`.

Check everything is connected at `http://localhost:5000/api/health`. The header
in the app also shows "Chain live" or what is missing.

## Notes

- The local Hardhat chain starts empty each time it restarts, so earlier on-chain balances disappear while EcoLedger's database keeps its record. Run `npm run deploy` again after restarting the chain; the wallet screen explains the difference if you see it.
- The backend signs mints with Hardhat's test account #0 by default. For any real network, set `OWNER_PRIVATE_KEY`, `RPC_URL` and `CONTRACT_ADDRESS`.
- CCT uses 0 decimals, so 1 point = 1 whole token.
