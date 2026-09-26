# Deploying EcoLedger

This guide puts EcoLedger online with a public link, using free plans only.

| Part | Where it runs | Why there |
| --- | --- | --- |
| App (what visitors open) | **Vercel** | Free static hosting with a `*.vercel.app` link |
| API | **Vercel** (or Render) | A second Vercel project runs the API as a serverless function. Free, no card, no sleeping. Render is an alternative if you prefer a classic server |
| Database | **MongoDB Atlas** | Free 512 MB cluster |
| Token | **Sepolia** test network | A public Ethereum test chain: real transactions anyone can look up on Etherscan, paid with free test ETH |

Plan about 45 minutes the first time. You need a GitHub account (the repo), and you will create free
accounts on Vercel and MongoDB Atlas, plus a MetaMask wallet. No bank card is needed.

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
3. *Network Access* → *Add IP address* → *Allow access from anywhere* (`0.0.0.0/0`). Vercel's
   addresses change, so this is needed on the free plan; the database password still protects it.
4. *Connect* → *Drivers* → copy the connection string. Put your password in it and add the database
   name `ecoledger` before the `?`:

   ```
   mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/ecoledger?retryWrites=true&w=majority
   ```

## 3. Put the API on Vercel

1. Sign up at [Vercel](https://vercel.com/signup) (*Hobby*, *Continue with GitHub*).
2. *Add New* → *Project* → import the **ecoledger** repository.
3. **Project Name**: `ecoledger-api`. **Framework Preset**: *Other*. **Root Directory**: `backend`.
   The rest comes from `backend/vercel.json`.
4. Open *Environment Variables* and add:

   | Name | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | any long random text (e.g. 40 random letters and numbers) |
   | `MONGO_URI` | the Atlas connection string from step 2 |
   | `ADMIN_EMAIL` | the email you will use to sign in as admin |
   | `ADMIN_PASSWORD` | a strong password for the admin |
   | `RPC_URL` | `https://ethereum-sepolia-rpc.publicnode.com` |
   | `OWNER_PRIVATE_KEY` | the same private key you deployed with in step 1 |
   | `CONTRACT_ADDRESS` | the address from step 1 |

5. Click *Deploy*. When it finishes, open `https://<your-api-project>.vercel.app/api/health`. You want
   `"database": true` and `"contract": true`. If not, the `reason` field says what is missing.

Notes: each request can carry at most 4.5 MB on Vercel, so proof photos are limited to 4 MB, and a
request may run for up to 60 seconds, which covers a Sepolia mint (10 to 30 seconds).

### Alternative: Render

If you prefer a classic always-on server, `render.yaml` sets up the API on [Render](https://render.com)
(*New* → *Blueprint*). Render asks new accounts to add a card, even for the free plan
(a $1 check that is released). Use the same environment variables as above; `JWT_SECRET` is generated
for you. Render's free plan sleeps after 15 minutes without traffic and takes up to a minute to wake up.

## 4. Put the app on Vercel

1. On Vercel, *Add New* → *Project* → import the **ecoledger** repository again (a second project).
2. **Project Name**: `ecoledger`.
3. Set **Root Directory** to `frontend`. Vercel picks up the build settings from `frontend/vercel.json`.
4. Under *Environment Variables* add:

   | Name | Value |
   | --- | --- |
   | `EXPO_PUBLIC_API_URL` | your API link followed by `/api`, e.g. `https://ecoledger-api.vercel.app/api` |

5. Click *Deploy*. After a few minutes you get your live link, e.g. `https://ecoledger.vercel.app`.

If you change `EXPO_PUBLIC_API_URL` later, redeploy the app on Vercel, because the address is built into it.

## 5. Connect them and check

1. In the `ecoledger-api` project → *Settings* → *Environment Variables*, add `CORS_ORIGIN` = your app's link
   (e.g. `https://ecoledger.vercel.app`, no slash at the end). Then *Deployments* → ⋯ on the latest → *Redeploy*.
   This allows only your site to call the API.
2. Open the Vercel link. The header should say **Chain live**.
3. Run the automatic check from your computer against the live API:

   ```bash
   cd backend
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=your-admin-password npm run smoke -- https://ecoledger-api.vercel.app
   ```

   It creates a test student, submits an activity, approves it and confirms the mint on Sepolia.
   (On Windows PowerShell, set the two variables first with `$env:ADMIN_EMAIL="..."` and `$env:ADMIN_PASSWORD="..."`.)
4. Try it by hand: create a student account, log an activity, sign in as the admin, approve it, and open
   the student's wallet. The mint receipt links to the transaction on Sepolia Etherscan.

---

## Good to know

- **The first request after a quiet spell takes a second or two** while Vercel starts the function
  (on Render's free plan it can take up to a minute; the app shows a "waking up" message).
- **Gas.** Each approval costs a tiny amount of Sepolia test ETH. If minting starts failing with
  "no ETH left for gas", top the wallet up from the faucet again. Approvals still count while the wallet is
  empty, and the admin can press *Retry mint* afterwards.
- **Keep the private key secret.** It only lives in your local `.env` and in the API project's environment
  settings. It is a test wallet, but anyone with the key could mint CCT.
- **Photos** are stored in MongoDB, so they survive restarts and redeploys. Atlas's free 512 MB fits a few
  thousand phone photos.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| Health says `"database": false` | Check `MONGO_URI` (password, `/ecoledger` part) and that Atlas allows `0.0.0.0/0` |
| `OWNER_PRIVATE_KEY is not set` | Add it to the API project's environment variables, then redeploy |
| `CONTRACT_ADDRESS is not set` or `No contract at ...` | Use the exact address from step 1, and make sure `RPC_URL` points to Sepolia |
| `The server key is not the contract owner` | `OWNER_PRIVATE_KEY` on the API must be the key you deployed with |
| App says it can't reach the server | Check `EXPO_PUBLIC_API_URL` ends in `/api`, redeploy on Vercel, and check `CORS_ORIGIN` matches the Vercel link exactly |
| Deploy fails | The project's *Deployments* → *Build Logs* show why; check the Root Directory (`backend` or `frontend`) |
