# County Transit · Trip Planner

A simple, correct beginning-to-end trip planner for **County Transit (Quinte Transit)**, 2026 schedule. Pick an origin, a destination, and a day of the week, and it finds the buses that make the trip.

Built with React 19 + Vite.

## Features

- **Direct trips** — any single bus that runs origin → destination, sorted by departure time.
- **Loop-around rides** — the routes are loops, so the planner also finds rides where you stay on board past the turnaround terminal onto the next loop (e.g. CML Snider School → Belleville on Route 2). These are flagged with a warning and show the turnaround point and any wait.
- **1 transfer** — cross-network trips via the **Bloomfield North** hub, the one stop where the concurrent weekend routes (Route 2 ⇄ Route 3) are timed to meet. This is what makes weekend Wellington/Belleville ↔ Picton journeys possible.
- **Day-of-week aware** — each trip declares which days it runs (weekday, Sat/Sun, Sat-only, Fri/Sat, event nights), so results — and transfer/loop connections — only include service that actually operates that day.
- **Honest time estimates** — untimed and on-request stops are carried forward from the previous timed stop and clearly marked (`~` prefix; `CALL AHEAD` badge).

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (default http://localhost:5173/).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Lint with oxlint |

## Data

Schedule data is modeled in [`src/TransitRoute.jsx`](src/TransitRoute.jsx). Each stop carries a canonical id (so the same physical stop matches regardless of its printed label at either end of a loop), a real clock time when the schedule gives one, and a status: timed, estimate (untimed), request (call-ahead), or no-service.

The source of truth is `County_Transit_2026_Schedule.xlsx` in this repo.

## Notes

- Routes are seasonal: Route 1 runs weekdays year-round (new schedule from July 6, 2026); Routes 2 & 3 run weekends July 3 – October 18, 2026; the Base31 late-night bus runs select event nights.
- Times shown for untimed/on-request stops are estimates — use the previous timed stop as your guide, and call/text ahead for on-request stops.
