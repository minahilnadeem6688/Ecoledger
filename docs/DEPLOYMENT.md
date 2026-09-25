# Deploying EcoLedger

This guide puts EcoLedger online with a public link, using free plans only.

| Part | Where it runs | Why there |
| --- | --- | --- |
| App (what visitors open) | **Vercel** | Free static hosting with a `*.vercel.app` link |
| API | **Render** | Runs a normal always-on Node server, which the API needs (uploads, waiting for blockchain transactions) |
| Database | **MongoDB Atlas** | Free 512 MB cluster |
| Token | **Sepolia** test network | A public Ethereum test chain: real transactions anyone can look up on Etherscan, paid with free test ETH |

Plan about 45 minutes the first time. You need a GitHub account (the repo), and you will create free
accounts on Vercel, Render and MongoDB Atlas, plus a MetaMask wallet.

> **Why not put the API on Vercel too?** Vercel runs code as short-lived functions. EcoLedger's API waits
> 10 to 30 seconds for each mint to be confirmed on Sepolia and keeps a connection to MongoDB, which fits
> a regular server much better. The app itself is a static website, which is exactly what Vercel is for.

---

## 1. Deploy the token to Sepolia

You do this once, from your own computer.

1. **Create a separate wallet for EcoLedger.** Install [MetaMask](https://metamask.io), create a *new*
   account just for this project (never use a wallet that holds real money), then
   *Account details → Show private key* and copy it.
2. **Get free test ETH.** Open a Sepolia faucet such as
   [Google Cloud's](https://cloud.google.com/application/web3/faucet/ethereum/sepolia), paste the
   wallet's address and request ETH. 0.05 Sepolia ETH is enough for hundreds of mints.
3. **Deploy.** In the `backend` folder, create a file named `.env` containing:

   ```env
   OWNER_PRIVATE_KEY=0xyour_private_key_here
   ```

   Then run:

   ```bash
   cd backend
   npm install
   npm run deploy:sepolia
   ```

   It prints the contract address and saves it to `backend/deployments/sepolia.json`.
   **Copy the address**, you need it in step 3. You can look it up on
   `https://sepolia.etherscan.io/address/<address>`.
4. Commit `backend/deployments/sepolia.json` so the address is recorded in the repo
   (the `.env` file is ignored by git and must never be committed).

## 2. Create the database

1. Sign up at [MongoDB Atlas](https://www.mongodb.com/atlas) and create a **free (M0)** cluster.
2. *Database Access* → add a database user with a password.
3. *Network Access* → *Add IP address* → *Allow access from anywhere* (`0.0.0.0/0`). Render's
   addresses change, so this is needed on the free plan; the database password still protects it.
4. *Connect* → *Drivers* → copy the connection string. Put your password in it and add the database
   name `ecoledger` before the `?`:

   ```
   mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/ecoledger?retryWrites=true&w=majority
   ```

## 3. Put the API on Render

1. Sign up at [Render](https://render.com) with GitHub.
2. *New* → *Blueprint* → choose the **ecoledger** repository. Render reads `render.yaml` and sets up a
   web service called `ecoledger-api`.
3. It asks for these values:

   | Setting | Value |
   | --- | --- |
   | `MONGO_URI` | the Atlas connection string from step 2 |
   | `ADMIN_EMAIL` | the email you will use to sign in as admin |
   | `ADMIN_PASSWORD` | a strong password for the admin |
   | `OWNER_PRIVATE_KEY` | the same private key you deployed with in step 1 |
   | `CONTRACT_ADDRESS` | the address printed in step 1 |
   | `CORS_ORIGIN` | leave empty for now, filled in step 5 |

   `JWT_SECRET` is generated for you and `RPC_URL` is already set to a free public Sepolia node.
4. Click *Apply*. When the deploy finishes, open
   `https://ecoledger-api.onrender.com/api/health` (your service URL may differ slightly). You want
   `"database": true` and `"contract": true`. If not, the `reason` field says what is missing.

## 4. Put the app on Vercel

1. Sign up at [Vercel](https://vercel.com) with GitHub.
2. *Add New* → *Project* → import the **ecoledger** repository.
3. Set **Root Directory** to `frontend`. Vercel picks up the build settings from `frontend/vercel.json`.
4. Under *Environment Variables* add:

   | Name | Value |
   | --- | --- |
   | `EXPO_PUBLIC_API_URL` | your Render URL followed by `/api`, e.g. `https://ecoledger-api.onrender.com/api` |

5. Click *Deploy*. After a few minutes you get your live link, e.g. `https://ecoledger.vercel.app`.

If you change `EXPO_PUBLIC_API_URL` later, redeploy the app on Vercel, because the address is built into it.

## 5. Connect them and check

1. On Render, open `ecoledger-api` → *Environment*, set `CORS_ORIGIN` to your Vercel link
   (e.g. `https://ecoledger.vercel.app`, no slash at the end) and save. This allows only your site to call the API.
2. Open the Vercel link. The header should say **Chain live**.
3. Run the automatic check from your computer against the live API:

   ```bash
   cd backend
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=your-admin-password npm run smoke -- https://ecoledger-api.onrender.com
   ```

   It creates a test student, submits an activity, approves it and confirms the mint on Sepolia.
   (On Windows PowerShell, set the two variables first with `$env:ADMIN_EMAIL="..."` and `$env:ADMIN_PASSWORD="..."`.)
4. Try it by hand: create a student account, log an activity, sign in as the admin, approve it, and open
   the student's wallet. The mint receipt links to the transaction on Sepolia Etherscan.

---

## Good to know

- **The first visit can be slow.** Render's free plan sleeps after 15 minutes without traffic and takes
  up to a minute to wake up. The app shows a "server is waking up" message meanwhile. A paid plan
  (or a free uptime pinger hitting `/api/health`) keeps it awake.
- **Gas.** Each approval costs a tiny amount of Sepolia test ETH. If minting starts failing with
  "no ETH left for gas", top the wallet up from the faucet again. Approvals still count while the wallet is
  empty, and the admin can press *Retry mint* afterwards.
- **Keep the private key secret.** It only lives in your local `.env` and in Render's environment
  settings. It is a test wallet, but anyone with the key could mint CCT.
- **Photos** are stored in MongoDB, so they survive Render restarts. Atlas's free 512 MB fits a few
  thousand phone photos.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| Health says `"database": false` | Check `MONGO_URI` (password, `/ecoledger` part) and that Atlas allows `0.0.0.0/0` |
| `OWNER_PRIVATE_KEY is not set` | Add it on Render, then *Manual Deploy → Deploy latest commit* |
| `CONTRACT_ADDRESS is not set` or `No contract at ...` | Use the exact address from step 1, and make sure `RPC_URL` points to Sepolia |
| `The server key is not the contract owner` | `OWNER_PRIVATE_KEY` on Render must be the key you deployed with |
| App says it can't reach the server | Check `EXPO_PUBLIC_API_URL` ends in `/api`, redeploy on Vercel, and check `CORS_ORIGIN` matches the Vercel link exactly |
| Render build fails | Render's *Logs* tab shows why; the blueprint expects Node 20 and the `backend` folder |
