# FoodSave AI

**Save Food. Save Money. Make an Impact.**

FoodSave AI is a web platform that connects restaurants, bakeries and grocers who have unsold food with nearby customers and charities, so surplus food is eaten instead of thrown away.

> Team: [Food Vengers] · Built as a working MVP prototype

---

## 1. Problem

- Food businesses end the day with unsold food that is thrown away, which means lost money and wasted resources.
- Students and families want cheaper meals but have no easy way to find surplus food nearby.
- Charities and NGOs rarely learn about food donations early enough to collect them safely.
- Businesses have no simple record of how much they waste or which days it happens.

## 2. Solution

A marketplace with two paths for leftover food:

1. **Sell at a discount:** nearby customers reserve food at a lower price and collect it before a deadline.
2. **Donate for free:** registered NGOs are alerted, request the food and arrange collection.

AI helps businesses choose a category and a discount, and shows which days create the most waste. The platform earns a small commission only on completed sales. Donations are always free.

## 3. Main features

**For customers**
- Marketplace with filters: distance, category, maximum price, pickup time, search and sorting
- Reserve food and get a 4-digit pickup code
- Order history, cancellation, and a personal "My impact" page (money saved, food rescued)
- Location-based alerts with an opt-in, radius and category choice (maximum 3 per hour)

**For businesses**
- Dashboard with revenue recovered, portions sold and donated, and collection rate
- Create listings (sale or donation) with photo, storage info, allergens and pickup deadline
- AI helper: suggested category, suggested discount with reasons, and "needs review" flags
- Confirm pickups with the customer's code, edit or withdraw listings, "Donate rest" to NGOs
- Waste insights: unsold food by weekday and category, with recommendations

**For NGOs**
- Alerts and a list of free donation offers nearby
- Request a donation, and see its status and pickup details once accepted

**For admins**
- Verify or revoke businesses and NGOs
- Platform-wide impact and commission totals

**Food-safety rules built into the code**
- Storage information and a safety confirmation are required to publish
- Pickup window limit of 12 hours (36 hours only with confirmed safe storage)
- Expired listings, reservations and donation requests close automatically; nothing is relisted
- AI only flags missing information and never declares food safe

## 4. Technology stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Frontend | HTML, CSS, JavaScript (no framework, no build step) |
| Database | JSON file (`server/data/db.json`), replaceable by Firebase / MongoDB / PostgreSQL |
| Authentication | JWT tokens, bcrypt password hashing, role-based access |
| AI | Rule-based pricing and categorisation, trend analysis, optional Google Gemini explanation |
| Other | dotenv, browser Geolocation API, Haversine distance formula |

## 5. Setup instructions

**Requirements:** [Node.js](https://nodejs.org) version 18 or newer, and Git.

```bash
git clone https://github.com/[YOUR-USERNAME]/foodsave-ai.git
cd foodsave-ai
copy .env.example .env      # Windows (use "cp" on Mac/Linux)
npm install
npm start
```

Open **http://localhost:3000**. Demo data is created automatically on the first start.

**Windows PowerShell shows a "running scripts is disabled" error?** Run
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, or use Command Prompt.

**Optional settings** (in `.env`): `PORT`, `JWT_SECRET`, `AUTO_VERIFY`, `COMMISSION_RATE`, `GEMINI_API_KEY`.
Without a Gemini key the app works the same, using its built-in rules.

**Other commands**
- `npm run dev`: restart automatically on server changes
- `npm run seed`: reset the demo data (demo listings expire over time, so reset before a demo)

## 6. How to run and demonstrate

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Customer | ayesha@foodsave.test | demo123 |
| Business | spice@foodsave.test | demo123 |
| NGO | hope@foodsave.test | demo123 |
| Admin | admin@foodsave.test | admin123 |

Tip: open each role in a separate browser window (use a private window for one).

### Suggested 5-minute demo

1. **Home page:** see the idea, live listings and impact numbers.
2. **Customer:** open *Find food*, apply filters, reserve a meal, and note the pickup code. Open *Notifications* and click **Send me a demo alert**.
3. **Business:** open the dashboard. In *New listing*, enter a food and price, then click **Suggest discount** to see the AI reasoning. Publish it and see how many nearby customers were alerted. In *Reservations*, enter the customer's code and click **Confirm**. Use **Donate rest** on a listing.
4. **NGO:** open *Donations*, request the food, then switch to the business and accept it.
5. **Impact page:** view the 14-day chart and the waste insights (business account). Log in as admin to see verification and platform totals.

## 7. Project structure

```
foodsave-ai/
├── server/               Backend
│   ├── index.js          Starts the server
│   ├── ai.js             Category, discount, review flags, trends, optional Gemini
│   ├── notify.js         Radius and opt-in alerts
│   ├── lifecycle.js      Automatic expiry
│   ├── seed.js           Demo data
│   └── routes/           API: auth, listings, orders, donations, notifications, insights, ai, admin
└── public/               Frontend
    ├── *.html            Pages
    ├── css/style.css     Theme (colours are variables at the top)
    └── js/               One script per page, plus shared app.js
```

## 8. API overview

All endpoints start with `/api`.

| Group | Examples |
|---|---|
| Accounts | `POST /auth/register`, `POST /auth/login`, `GET/PUT /auth/me` |
| Listings | `GET /listings`, `POST /listings`, `POST /listings/:id/donate` |
| Orders | `POST /orders`, `GET /orders/mine`, `POST /orders/:id/collect` |
| Donations | `GET /donations/available`, `POST /donations/request`, `POST /donations/:id/accept` |
| Notifications | `GET /notifications`, `POST /notifications/simulate` |
| Insights and AI | `GET /insights/impact`, `GET /insights/trends`, `POST /ai/discount` |
| Admin | `GET /admin/orgs`, `POST /admin/orgs/:id/verify` |

## 9. Business model

- **Commission:** 10% on completed discounted sales (example: Rs. 3,600 in sales earns Rs. 360). The rate is an assumption to be tested in a pilot.
- **Later:** business subscriptions, premium analytics and sponsorships.
- **Donations stay free** for NGOs.

## 10. Current limitations and next steps

This is an MVP prototype. These parts are simulated or simplified:

- **Payments** are simulated. Each order records the total and commission, but no real payment provider is connected. Next: JazzCash, Easypaisa or Stripe.
- **Notifications** appear in the app only. Next: push, SMS or WhatsApp.
- **Database** is a JSON file. Next: a cloud database.
- **Distance** uses saved coordinates. Next: a map view.
- **"Kg rescued"** is an estimate (0.4 kg per portion).
- **AI** uses transparent rules now. Trained models can follow once real data exists.
- Demo data is sample data, not real results.

Before any public launch: set a strong `JWT_SECRET`, add HTTPS and rate limiting, and add clear terms of use. Businesses remain responsible for the safety of the food they list.


*FoodSave AI: Save Food. Save Money. Make an Impact.*