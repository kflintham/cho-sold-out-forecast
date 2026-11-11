# Sold-out forecast — Elevate demo for CHO

**Live demo:** [chofashion.elevategroup.agency](https://chofashion.elevategroup.agency) — deploys automatically from `main`.

A working demonstrator of a **sold-out forecast** for a multi-brand fashion boutique: when a line
sells out early and the brand has no stock to top up, how many customers were actually missed — and
how much to buy next season so the order isn't based on the stock you happened to have.

**Everything in this demo is synthetic.** Every brand, style and number is invented. Weekly sales
are simulated from a hidden "true demand" per line and capped by the stock the shop had, exactly how
a sell-out hides demand in real till data. The engine never sees the hidden demand — it recovers it
from sales and stock alone, as it would from EPOS / Shopify history in production.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

No backend, no environment variables — everything runs in the browser.

## The demo, screen by screen

A multi-brand boutique with two shops and a website, six (invented) brands, SS26 finished and AW26
ten weeks in.

1. **Overview** — SS26 sales, how many lines sold out early, the full-price sales missed after they
   did, and the same thing happening again this season. Below it, filtered by brand, category and
   location: weekly units, stock on hand, online share, customers waiting, aged stock, advisories,
   stock health, ABC classes, stock age, sales by channel, where the stock sits, clearance routes.
2. **Sold-out forecast** — the core of it. *Bought 12 → sold out in week 4 of 16 → ≈47 customers
   wanted it → buy 35 next time (usual rule: 15).* Week-by-week chart with the missed demand drawn
   in, and the working shown step by step. Flip **"Count the demand a sell-out hides"** off to see
   the order you'd place from till sales alone.
3. **True demand** — this season, per line: demand still to come + customers waiting (notify-me
   and shop requests) − stock in each location − open re-orders. Bridge chart, sell-out risks, and
   the full plan with stock by location.
4. **SS27 buy plan** — every SS26 line re-bought on demand, grouped by brand in order-book-deadline
   order, against the usual rule and the open-to-buy budget. Sell-outs step up; slow lines come down.
5. **Deliveries** — re-orders to place this week and those already on their way, re-orders against
   each brand's carriage-paid minimum, the SS27 delivery calendar, and a brand scorecard
   (sell-through, sell-outs, on time in full, days late, completeness).
6. **Order timeline** — each SS27 order from showroom to shop floor; nothing is placed until its
   budget is signed off (Kestrel & Co is held). Click a stage to update it; add your own orders.
7. **Advisories** — sold out and can't restock, re-order now, already covered by an open re-order,
   move stock between locations, hold full price, mark down early, aged stock, order books closing.
8. **Scenarios** — three "ask the system" questions answered by re-running the engine: buying 30
   instead of 12, a late Maison Ondine delivery, backing all the missed demand with no cap.
9. **Levers** — share of missed demand to back, waiting customers, brand momentum, planned
   sell-through, step-up cap, size-run rounding, usual rule, aged-stock threshold, budget.

## How the estimate works

1. Learn each brand's season shape from its lines that **never** sold out (smoothed, and blended
   with the whole shop's shape so a brand with few lines isn't noisy).
2. For a line that sold out, read only the weeks that **ended with stock on the shelf** — those saw
   every customer who came in. Weeks that ended empty only set a floor.
3. Scale up: sold in those weeks ÷ the share of a normal season those weeks represent = full-season
   demand. Each sister line's shape on its own gives the likely range.
4. Next season = sold + chosen share of the missed demand, × brand momentum, ÷ planned
   sell-through, capped at a multiple of last buy, rounded to whole size runs.

```
src/
  data/dataset.ts     brands, locations, SS26 + AW26 lines, simulated weekly sales/stock
                      (seeded), waitlists, re-orders, older stock, brand scorecard,
                      SS27 delivery drops and order timelines
  engine/forecast.ts  season shapes, demand recovery, in-season projection, next-season buy
  engine/stock.ts     true demand, transfers, stock health, ABC, stock age, clearance
  engine/alerts.ts    advisories with the working attached
  engine/scenario.ts  the three what-if questions
  engine/levers.ts    the buying rules the shop controls
  views/              the nine screens
  components/         SeasonChart, line drawer, charts, UI kit
```

---

Built by [Elevate Group](https://elevategroup.agency) · demo dataset anchored to Thu 12 Nov 2026.
