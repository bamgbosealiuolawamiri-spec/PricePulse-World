# PricePulse World
*Know the price. Compare the world. Save smarter.*

React + Vite + TypeScript + Tailwind + Leaflet/OpenStreetMap. Launch market: Lagos, Nigeria (NGN).

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview
```
Requires Node 18+. No API keys or paid services are needed.

## Deploy to Netlify
1. Push to GitHub: `git init && git add . && git commit -m "PricePulse" && git remote add origin <url> && git push -u origin main`
2. Netlify → Add new site → Import from Git → pick the repo. `netlify.toml` sets build command `npm run build`, publish dir `dist`, Node 20, and an SPA fallback.
3. Or CLI: `npx netlify-cli deploy --build --prod`.

## Honest data policy
`src/data.ts` holds **clearly labelled demo data**: placeholder shops ("Demo Shop A…"), sample prices and synthetic history. Nothing is a live price, verified shop, stock level or review. Saved items, alerts, basket, location and price submissions live in `localStorage` only; submissions are **not** shared with anyone and receipts are not uploaded.

## Expansion
- Currencies: add to `CUR` in `src/data.ts` (symbol + rate); all prices pass through `money()`.
- Countries/cities: `COUNTRIES` and `AREAS`; add areas with lat/lng.
- Real data: replace the helpers (`offersFor`, `history`, `SHOPS`) with a backend/API client. Keep secrets server-side (e.g. Netlify Functions) and never in frontend code.

## Not included yet
Accounts, backend, real notifications, moderation, receipt storage, real shop/price data.
