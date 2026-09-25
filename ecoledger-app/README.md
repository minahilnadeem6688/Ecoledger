# EcoLedger app

Expo Router app for students and admins. It runs on the web and on phones, and the
layout adapts to phone, tablet and desktop widths.

```bash
npm install
npm run web          # browser
npx expo start       # Expo Go on a phone (same Wi-Fi as the computer running the API)
```

Start the API first (see the [main README](../README.md)). The API address is
worked out automatically; set `EXPO_PUBLIC_API_URL` to override it.

| Screen | Route |
| --- | --- |
| Sign in / create account | `/login` |
| Student home | `/` |
| Log an activity | `/submit-activity` |
| My activities | `/activities` |
| Wallet | `/wallet` |
| Rewards | `/rewards` |
| Leaderboard | `/leaderboard` |
| Admin review | `/admin` |

Code layout: `app/` screens, `components/ui.tsx` shared UI kit,
`components/activity.tsx` activity rows, `lib/api.ts` API client,
`lib/session.tsx` sign-in state and server status, `lib/queue.ts` offline submissions,
`constants/theme.ts` colours and spacing.
