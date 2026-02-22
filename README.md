# Picks4All — Free Football Prediction Pools

**[picks4all.com](https://picks4all.com)**

Create free football prediction pools and compete with friends, family, or coworkers. Predict match results for World Cup 2026, Champions League, and more.

Known as **quiniela** in Mexico, **polla futbolera** in Colombia, **prode** in Argentina, **penca** in Uruguay, and **porra** in Spain.

## Features

- **Create pools** — Set up your own prediction pool with custom scoring rules and deadlines
- **Invite with a code** — Share a simple invite code via WhatsApp or any messenger
- **Predict match scores** — Enter your picks before each match deadline
- **Live leaderboard** — Rankings update automatically after every match
- **Multi-tournament** — World Cup 2026, Champions League, and more
- **Multi-language** — Available in Spanish, English, and Portuguese
- **100% free** — No real money, no gambling, just fun

## Tech Stack

- **Frontend:** Next.js 16 (App Router) + TypeScript
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** JWT + Google Sign-In
- **i18n:** next-intl (ES/EN/PT)
- **Deployment:** Railway

## Getting Started

```bash
# Backend
cd backend
docker compose up -d
npm install
npx prisma migrate dev
npm run dev

# Frontend
cd frontend-next
npm install
npm run dev
```

## License

All rights reserved. This is proprietary software.

---

**[picks4all.com](https://picks4all.com)** — Free sports prediction pools with friends.
