# EcoLedger app

Expo Router app for students and admins. One codebase runs on the web, Android and iOS, with layouts
for phone, tablet and desktop widths. See the [main README](../README.md) for the full picture.

```bash
npm install
npm run web          # browser, http://localhost:8081
npx expo start       # Expo Go on a phone (same Wi-Fi as the computer running the API)
```

Start the API first. The app finds it by itself (same computer, port 5000). To use another API, set
`EXPO_PUBLIC_API_URL`, e.g. `https://ecoledger-api.onrender.com/api` (see [`.env.example`](.env.example)).

## Screens

| Screen | Route | Who |
| --- | --- | --- |
| Sign in / create account | `/login` | everyone |
| Home | `/` | students |
| Log an activity | `/submit-activity` | students |
| My activities | `/activities` | students |
| Wallet | `/wallet` | students |
| Rewards | `/rewards` | students |
| Leaderboard | `/leaderboard` | everyone signed in |
| Review | `/admin` | admins |

## Code layout

| Path | Contents |
| --- | --- |
| `app/` | Screens; the file name is the route |
| `components/ui.tsx` | Shared UI kit: page frame, header, cards, buttons, fields, grid, toasts |
| `components/activity.tsx` | Activity row with status and mint receipt |
| `lib/api.ts` | API client and types |
| `lib/session.tsx` | Sign-in state, server status polling, toasts |
| `lib/queue.ts` | Offline queue for activities submitted without a connection |
| `lib/useLoad.ts` | Load data when a screen comes into focus |
| `constants/theme.ts` | Colours, spacing, radii and breakpoints |

## Build for the web

```bash
npx expo export --platform web    # static site in dist/
```

`vercel.json` holds the Vercel settings (build command, output folder and routing).
