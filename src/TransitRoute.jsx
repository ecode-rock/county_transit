import React, { useMemo, useState } from "react";
import { ArrowRightLeft, MapPin, Phone, Clock, CalendarDays, AlertTriangle, Repeat } from "lucide-react";

/*
 * Beginning -> ending bus trip planner (full schedule).
 *
 * Correctness choices:
 *  - Every stop has an explicit canonical `id`, so the same physical stop under
 *    different printed labels (e.g. "Metro Picton (Grocery Store)" vs "(Arrival)")
 *    matches regardless of which end of a loop it sits on.
 *  - Each stop is timed (real clock minutes), estimate (untimed -> carried
 *    forward from the previous timed stop), request (call-ahead, no time), or
 *    none (No Service on this run -> not boardable).
 *  - Each trip declares which weekdays it runs, so the Day selector filters to
 *    services that actually operate that day.
 *  - Direct only: a trip matches when it visits the origin id and then, later in
 *    the same trip, the destination id.
 */

// --- Canonical stop names --------------------------------------------------
const STOP_NAME = {
  belleville: "Belleville Transit Terminal",
  rossmore: "Rossmore Plaza",
  huff: "Huff Estates",
  bloomfield: "Bloomfield",
  "prinzen-s": "Prinzen Ford South",
  "prinzen-n": "Prinzen Ford North",
  waring: "The Waring House",
  "loyalist-s": "Loyalist Pkwy at George Wright Blvd S.",
  "loyalist-n": "Loyalist Pkwy at George Wright Blvd N.",
  "main-kfc": "86 Main St (near KFC)",
  mary: "Mary St",
  "maccaulay-s": "Maccaulay Museum South",
  "maccaulay-n": "Maccaulay Museum North",
  "base31-commissary": "Base31 Commissary",
  "base31-drill": "Base31 Drill Hall (Hangar 6)",
  "macaulay-village": "Macaulay Village (London Ave)",
  "picton-harbour": "Picton Harbour",
  crystal: "Crystal Palace",
  paul: "Paul St (near Barker)",
  "king-ross": "King St (near Ross)",
  "king-bowery": "King St (near Bowery)",
  "metro-picton": "Metro Picton",
  "rec-centre": "Recreation Centre",
  heritage: "Heritage Drive Path",
  lakeside: "The Lakeside",
  "wellington-church": "Wellington United Church",
  "wellington-beach-s": "Wellington Beach South",
  "wellington-beach-n": "Wellington Beach North",
  "wellington-harbour-s": "Wellington Harbour South",
  "wellington-harbour-n": "Wellington Harbour North",
  eddie: "The Eddie Hotel & Farm",
  "cml-snider": "CML Snider School",
  legion: "The Legion",
  "sandbanks-medical": "Sandbanks Medical",
  "picton-all": "Picton stops (on request)",
  wellington: "Wellington",
};

// --- Day sets --------------------------------------------------------------
const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const SATSUN = ["Sat", "Sun"];
const SATONLY = ["Sat"];
const FRISAT = ["Fri", "Sat"];
const EVENT = ["Fri", "Sat"]; // Base31 late-night: select event nights only

// --- Stop builders ---------------------------------------------------------
// `label` overrides the canonical name for display only. Used for Bloomfield:
// North and South are one crossroads (a street apart), so they share the id
// `bloomfield` for matching, but each result still shows the actual side.
const T = (id, minutes, note, label) => ({ id, minutes, status: "timed", note, label });
const E = (id, note, label) => ({ id, minutes: null, status: "estimate", note, label });
const R = (id, note, label) => ({ id, minutes: null, status: "request", note, label });
const N = (id, note, label) => ({ id, minutes: null, status: "none", note, label });

// Bloomfield stop shorthands — same id, different printed side.
const BN = (minutes, note) => T("bloomfield", minutes, note, "Bloomfield North");
const BS = (minutes, note) => T("bloomfield", minutes, note, "Bloomfield South");

// --- Route 1 (weekday loop: Belleville -> Picton -> Belleville) -------------
// timed values: [depart, bloomfieldS, mainKFC, base31, maccaulayN, crystal,
//                paul, kingRoss, metro, bloomfieldN, arrive]
function r1(trip, v) {
  const [dep, bs, main, b31, mn, cr, pa, kr, me, bn, arr] = v;
  return {
    route: "Route 1", label: "Route 1 · Weekday", runDays: "Monday–Friday", days: WEEKDAY, trip,
    stops: [
      T("belleville", dep), R("rossmore"), R("huff"), BS(bs), E("prinzen-s"),
      R("waring"), E("loyalist-s"), T("main-kfc", main), E("mary"), E("maccaulay-s"),
      T("base31-commissary", b31), E("macaulay-village"), T("maccaulay-n", mn), E("picton-harbour"),
      T("crystal", cr), T("paul", pa), T("king-ross", kr), E("king-bowery"), T("metro-picton", me),
      E("loyalist-n"), R("waring"), E("prinzen-n"), BN(bn), R("huff"), R("rossmore"),
      T("belleville", arr),
    ],
  };
}

// --- Route 2 (weekend loop: Wellington -> Belleville -> Wellington) ---------
// timed: [rec, church, bloomN(out), bellArrive, bellDepart, bloomN(ret), cml, recArrive]
function r2(trip, days, runDays, v) {
  const [rec, ch, bno, ba, bd, bnr, cml, reca] = v;
  return {
    route: "Route 2", label: "Route 2 · Weekend", runDays, days, trip,
    stops: [
      T("rec-centre", rec), E("heritage"), E("lakeside"), T("wellington-church", ch),
      E("wellington-beach-s"), E("wellington-harbour-s"), R("eddie"), BN(bno),
      R("huff"), R("rossmore"), T("belleville", ba), T("belleville", bd), R("rossmore"), R("huff"),
      BN(bnr), R("eddie"), E("wellington-harbour-n"), E("wellington-beach-n"),
      T("cml-snider", cml), E("legion"), E("sandbanks-medical"), T("rec-centre", reca),
    ],
  };
}

// --- Route 3 (weekend loop: Picton -> Bloomfield -> Picton) -----------------
// timed: [metro, bloomN, mary, base31, maccaulayN, kingRoss, metroArrive]
function r3(trip, days, runDays, v) {
  const [me, bn, ma, b31, mn, kr, mea] = v;
  return {
    route: "Route 3", label: "Route 3 · Weekend", runDays, days, trip,
    stops: [
      T("metro-picton", me), E("loyalist-n"), R("waring"), E("prinzen-n"), BN(bn),
      E("prinzen-s"), R("waring"), E("main-kfc"), T("mary", ma), E("maccaulay-s"),
      T("base31-commissary", b31), R("base31-drill"), E("macaulay-village"), T("maccaulay-n", mn),
      E("picton-harbour"), T("king-ross", kr), E("king-bowery"), T("metro-picton", mea),
    ],
  };
}

// --- Base31 late-night (event nights: Base31 -> Picton -> ... -> Belleville) -
function bnite(trip, drill, kr, bloom, well, bell) {
  return {
    route: "Base31 Late-Night", label: "Base31 Late-Night", runDays: "Select Fri/Sat event nights",
    days: EVENT, trip,
    stops: [T("base31-drill", drill), E("picton-all"), T("king-ross", kr), bloom, well, bell],
  };
}

const TRIPS = [
  // Route 1 — weekday
  r1("Morning Trip 1", [335, 363, 371, 379, 385, 390, 395, 396, 402, 410, 445]),
  r1("Morning Trip 2", [455, 483, 491, 499, 505, 510, 515, 516, 522, 530, 565]),
  r1("Morning Trip 3", [605, 633, 641, 649, 655, 660, 665, 666, 672, 680, 715]),
  r1("Afternoon Trip 1", [815, 843, 851, 859, 865, 870, 875, 876, 882, 890, 925]),
  r1("Afternoon Trip 2", [935, 963, 971, 979, 985, 990, 995, 996, 1002, 1010, 1045]),
  r1("Evening Trip", [1085, 1113, 1121, 1129, 1135, 1140, 1145, 1146, 1152, 1160, 1195]),

  // Route 2 — weekend
  r2("Trip 1", SATSUN, "Saturday & Sunday", [608, 618, 631, 657, 661, 691, 704, 714]),
  r2("Trip 2", SATSUN, "Saturday & Sunday", [714, 724, 737, 763, 767, 797, 810, 820]),
  r2("Trip 3", SATSUN, "Saturday & Sunday", [820, 830, 843, 873, 903, 933, 946, 956]),
  r2("Trip 4", SATONLY, "Saturday only", [956, 966, 979, 1005, 1009, 1039, 1052, 1062]),
  r2("Trip 5", FRISAT, "Friday & Saturday", [1062, 1072, 1085, 1111, 1115, 1145, 1158, 1168]),
  r2("Trip 6", FRISAT, "Friday & Saturday", [1168, 1178, 1191, 1217, 1221, 1251, 1264, 1274]),
  {
    route: "Route 2", label: "Route 2 · Weekend", runDays: "Friday & Saturday", days: FRISAT,
    trip: "Trip 7 (Last Bus)",
    stops: [
      T("rec-centre", 1274), E("heritage"), E("lakeside"), T("wellington-church", 1284),
      E("wellington-beach-s"), E("wellington-harbour-s"), R("eddie"), BN(1297),
      R("huff"), R("rossmore"),
      T("belleville", 1325, "Last bus of the night — arrives Belleville ~10:05 PM. On Jul 17 & Aug 28 this run ends in Bloomfield instead."),
      N("belleville"), N("rossmore"), N("huff"), N("bloomfield", undefined, "Bloomfield North"), N("eddie"),
      N("wellington-harbour-n"), N("wellington-beach-n"), N("cml-snider"), N("legion"),
      N("sandbanks-medical"), N("rec-centre"),
    ],
  },

  // Route 3 — weekend
  r3("Trip 1", SATSUN, "Saturday & Sunday", [617, 631, 642, 649, 654, 660, 663]),
  r3("Trip 2", SATSUN, "Saturday & Sunday", [675, 691, 702, 709, 714, 720, 723]),
  r3("Trip 3", SATSUN, "Saturday & Sunday", [723, 737, 748, 755, 760, 766, 769]),
  r3("Trip 4", SATSUN, "Saturday & Sunday", [781, 797, 808, 815, 820, 826, 829]),
  r3("Trip 5", SATSUN, "Saturday & Sunday", [829, 843, 854, 861, 866, 872, 875]),
  r3("Trip 6", SATONLY, "Saturday only", [917, 933, 944, 951, 956, 962, 965]),
  r3("Trip 7", SATONLY, "Saturday only", [965, 979, 990, 997, 1002, 1008, 1011]),
  r3("Trip 8", SATONLY, "Saturday only", [1023, 1039, 1050, 1057, 1062, 1068, 1071]),
  r3("Trip 9", FRISAT, "Friday & Saturday", [1071, 1085, 1096, 1103, 1108, 1114, 1117]),
  r3("Trip 10", FRISAT, "Friday & Saturday", [1129, 1145, 1156, 1163, 1168, 1174, 1177]),
  r3("Trip 11", FRISAT, "Friday & Saturday", [1177, 1191, 1202, 1209, 1214, 1220, 1223]),
  r3("Trip 12", FRISAT, "Friday & Saturday", [1235, 1251, 1262, 1269, 1274, 1280, 1283]),
  {
    route: "Route 3", label: "Route 3 · Weekend", runDays: "Friday & Saturday", days: FRISAT,
    trip: "Trip 13 (Last Bus)",
    stops: [
      T("metro-picton", 1283), E("loyalist-n"), R("waring"), E("prinzen-n"), BN(1297),
      E("prinzen-s"), R("waring"), E("main-kfc"), T("mary", 1307), E("maccaulay-s"),
      T("base31-commissary", 1314),
      R("base31-drill", "Trip ends here — no service to the remaining Picton stops on this run."),
      N("macaulay-village"), N("maccaulay-n"), N("picton-harbour"), N("king-ross"),
      N("king-bowery"), N("metro-picton"),
    ],
  },

  // Base31 late-night — event nights
  bnite("Departure 1", 1340, 1346, N("bloomfield", undefined, "Bloomfield North"), N("wellington"), N("belleville")),
  bnite("Departure 2", 1350, 1356, N("bloomfield", undefined, "Bloomfield North"), N("wellington"), N("belleville")),
  bnite("Departure 3", 1360, 1366, N("bloomfield", undefined, "Bloomfield North"), N("wellington"), N("belleville")),
  bnite("Departure 4", 1370, 1376, N("bloomfield", undefined, "Bloomfield North"), N("wellington"), N("belleville")),
  bnite("Departure 5", 1380, 1386, E("bloomfield", undefined, "Bloomfield North"), E("wellington"), N("belleville")),
  bnite("Departure 6", 1390, 1396, E("bloomfield", undefined, "Bloomfield North"), N("wellington"), T("belleville", 1429)),
  bnite("Departure 7", 1440, 1446, E("bloomfield", undefined, "Bloomfield North"), E("wellington"), N("belleville")), // 12:00a / 12:06a
];

// --- Boardable stop list for the dropdowns ---------------------------------
const BOARDABLE = new Set();
for (const t of TRIPS) for (const s of t.stops) if (s.status !== "none") BOARDABLE.add(s.id);
const STOPS = [...BOARDABLE]
  .map((id) => ({ id, name: STOP_NAME[id] }))
  .sort((a, b) => a.name.localeCompare(b.name));

const ROUTE_COLOR = {
  "Route 1": "#D0263D",
  "Route 2": "#3AA6D9",
  "Route 3": "#E8A33D",
  "Base31 Late-Night": "#9B7FE0",
};

// The only real transfer hub. Route 2 (Wellington side) and Route 3 (Picton
// side) are the only routes that run the same days AND share a stop — Bloomfield
// — where the schedule times them to meet. Route 1 is weekday-only (never
// concurrent with 2/3), and Base31 is a one-way post-event bus that starts after
// 2/3 have stopped for the night — so neither is a usable transfer partner.
const HUB_ID = "bloomfield";
const HUB_ROUTES = new Set(["Route 2", "Route 3"]);

// Display name for a stop: its per-occurrence side label (Bloomfield N/S) if
// present, otherwise the canonical name.
const stopLabel = (s) => (s && s.label) || (s && STOP_NAME[s.id]) || (s && s.id) || "";

const DAYS = [
  ["Any", "Any day"], ["Mon", "Monday"], ["Tue", "Tuesday"], ["Wed", "Wednesday"],
  ["Thu", "Thursday"], ["Fri", "Friday"], ["Sat", "Saturday"], ["Sun", "Sunday"],
];

// --- Time helpers ----------------------------------------------------------
function fmt(mins) {
  if (mins === null || mins === undefined) return "--:--";
  let h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

// Carry the last real time forward so untimed/request stops still show an
// estimate. No-Service stops get no time and don't advance the clock.
function withEffectiveTimes(stops) {
  let last = null;
  return stops.map((s) => {
    if (s.status === "none") return { ...s, effMinutes: null, estimated: false };
    if (s.minutes !== null && s.minutes !== undefined) {
      last = s.minutes;
      return { ...s, effMinutes: s.minutes, estimated: false };
    }
    return { ...s, effMinutes: last, estimated: last !== null };
  });
}

const RESOLVED = TRIPS.map((t) => ({ ...t, stops: withEffectiveTimes(t.stops) }));

// --- Loop metadata ---------------------------------------------------------
// The listed "trips" on Routes 1/2/3 are single loops of one bus; consecutive
// trips continue on the same vehicle. A rider can board on the return leg and
// stay aboard past the turnaround (the "seam" = the terminal a trip starts and
// ends at) onto the next loop. Base31 Late-Night is one-way and never wraps.
const isLoopRoute = (route) => route !== "Base31 Late-Night";

for (const t of RESOLVED) {
  const lastBoardable = [...t.stops].reverse().find((s) => s.status !== "none");
  t.startMin = t.stops[0].effMinutes;
  t.endMin = lastBoardable.effMinutes;
  t.firstId = t.stops[0].id;      // terminal the loop departs from
  t.lastId = lastBoardable.id;    // terminal the loop returns to (seam)
}

const TRIPS_BY_ROUTE = {};
for (const t of RESOLVED) (TRIPS_BY_ROUTE[t.route] ||= []).push(t);
for (const r in TRIPS_BY_ROUTE) TRIPS_BY_ROUTE[r].sort((a, b) => a.startMin - b.startMin);

const shareDay = (a, b) => a.days.some((d) => b.days.includes(d));

// Trips that continue T's loop: same route, start at/after T ends, begin where T
// finished (seam match), and run on a compatible day. Because a truncated
// last-bus run ends somewhere other than its start terminal, nothing seam-matches
// it as a successor — so you can never be chained past end-of-service.
function continuingSuccessors(T, day) {
  return (TRIPS_BY_ROUTE[T.route] || [])
    .filter(
      (t2) =>
        t2 !== T &&
        t2.startMin >= T.endMin &&
        t2.firstId === T.lastId &&
        (day === "Any" ? shareDay(t2, T) : t2.days.includes(day))
    )
    .sort((a, b) => a.startMin - b.startMin);
}

// The destination as a boardable stop anywhere in a (successor) trip.
function findInTrip(trip, destId) {
  const d = trip.stops.findIndex((s) => s.id === destId && s.status !== "none");
  return d === -1 ? null : trip.stops[d];
}

// A loop-around ride: board origin on T's return leg, ride past the seam, alight
// at the destination on the earliest continuing trip that actually serves it.
// Only used when the destination is NOT reachable later within T itself.
function findLoopRide(T, originId, destId, day) {
  if (!isLoopRoute(T.route)) return null;
  const o = T.stops.findIndex((s) => s.id === originId && s.status !== "none");
  if (o === -1) return null;
  if (T.stops.findIndex((s, i) => i > o && s.id === destId && s.status !== "none") !== -1) return null;
  for (const T2 of continuingSuccessors(T, day)) {
    const dest = findInTrip(T2, destId);
    if (dest) return { origin: T.stops[o], dest, T, T2 };
  }
  return null;
}

// Find the best direct ride within a trip: board the origin, alight the
// destination at a LATER index. A stop can appear more than once in a loop
// (e.g. unified Bloomfield on Route 1: outbound South + return North), so we
// consider every boarding and pick the one that reaches the destination
// soonest — tie-broken by the latest departure (the shortest time on board).
// Without this, boarding the "wrong" Bloomfield side would ride the whole loop.
function findDirect(trip, originId, destId) {
  let best = null;
  for (let o = 0; o < trip.stops.length; o++) {
    const so = trip.stops[o];
    if (so.id !== originId || so.status === "none") continue;
    const d = trip.stops.findIndex((s, i) => i > o && s.id === destId && s.status !== "none");
    if (d === -1) continue;
    const cand = { from: so, to: trip.stops[d] };
    if (!best) {
      best = cand;
      continue;
    }
    const a = cand.to.effMinutes ?? Infinity;
    const b = best.to.effMinutes ?? Infinity;
    const later = (cand.from.effMinutes ?? -Infinity) > (best.from.effMinutes ?? -Infinity);
    if (a < b || (a === b && later)) best = cand;
  }
  return best;
}

// Board the hub at the earliest departure at/after `minDepart` that still reaches
// the destination later in the same trip. Scans every hub occurrence, so a loop
// route whose hub appears twice (e.g. Route 2's outbound + return Bloomfield)
// picks the boarding that actually makes the connection.
function findConnection(trip, hubId, destId, minDepart) {
  for (let i = 0; i < trip.stops.length; i++) {
    const s = trip.stops[i];
    if (s.id !== hubId || s.status === "none" || s.effMinutes === null) continue;
    if (s.effMinutes < minDepart) continue;
    const d = trip.stops.findIndex((x, j) => j > i && x.id === destId && x.status !== "none");
    if (d !== -1) return { from: s, to: trip.stops[d] };
  }
  return null;
}

// --- UI --------------------------------------------------------------------
function TimeBadge({ estimated, status }) {
  if (status === "request") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#3a3320", color: "#E8C468", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>
        <Phone size={11} /> CALL AHEAD
      </span>
    );
  }
  if (estimated) {
    return <span style={{ fontSize: 11, fontWeight: 600, color: "#8a92a3", padding: "2px 8px", borderRadius: 999, background: "#232838" }}>~ EST.</span>;
  }
  return null;
}

function Endpoint({ label, stop, color, isDot }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <span style={{ marginTop: 6, width: 10, height: 10, borderRadius: "50%", background: isDot ? color : "#12161f", border: `2px solid ${color}`, flexShrink: 0 }} />
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 600, color: "#F5F1E8" }}>
            {stop.estimated ? "~" : ""}{fmt(stop.effMinutes)}
          </span>
          <TimeBadge estimated={stop.estimated} status={stop.status} />
        </div>
        <div style={{ fontSize: 14, color: "#c3c9d6", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function ResultCard({ r }) {
  const color = ROUTE_COLOR[r.route] || "#8a92a3";
  const dur = r.from.effMinutes !== null && r.to.effMinutes !== null ? r.to.effMinutes - r.from.effMinutes : null;
  const note = r.from.note || r.to.note;
  return (
    <div style={{ background: "#1a1f2b", border: "1px solid #2a3040", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, letterSpacing: 1, color, fontWeight: 600, textTransform: "uppercase" }}>{r.label}</span>
        <span style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>{r.trip}</span>
      </div>
      <Endpoint label={r.fromName} stop={r.from} color={color} isDot />
      <Endpoint label={r.toName} stop={r.to} color={color} isDot={false} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#6b7280" }}>{r.runDays}</span>
        {dur !== null && dur > 0 && (
          <span style={{ fontFamily: "monospace", fontSize: 12, color: "#8a92a3", background: "#12161f", padding: "3px 8px", borderRadius: 6 }}>~{dur} min</span>
        )}
      </div>
      {note && (
        <div style={{ fontSize: 12, color: "#C9A6F5", background: "#241a33", borderRadius: 8, padding: "6px 10px", lineHeight: 1.5 }}>{note}</div>
      )}
    </div>
  );
}

function LoopCard({ r }) {
  const color = ROUTE_COLOR[r.route] || "#8a92a3";
  const dur = r.to.effMinutes - r.from.effMinutes;
  return (
    <div style={{ background: "#1a1f2b", border: "1px solid #4a3a2a", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, letterSpacing: 1, color, fontWeight: 600, textTransform: "uppercase" }}>
          <Repeat size={13} />{r.label}
        </span>
        <span style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>{r.trip}</span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#332614", border: "1px solid #5a4420", borderRadius: 8, padding: "8px 10px" }}>
        <AlertTriangle size={15} color="#E8A33D" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12, color: "#E8C468", lineHeight: 1.5 }}>
          Stay on board through <b>{r.viaName}</b> — the bus completes its loop and continues.
          {r.wait > 0 ? ` About ${r.wait} min at ${r.viaName}.` : ""} Confirm with the driver before riding past the turnaround.
        </span>
      </div>

      <Endpoint label={r.fromName} stop={r.from} color={color} isDot />
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <span style={{ width: 10, display: "flex", justifyContent: "center", flexShrink: 0, color }}>
          <Repeat size={12} />
        </span>
        <div style={{ fontSize: 12, color: "#8a92a3" }}>
          via {r.viaName} · {fmt(r.viaArrive)}{r.wait > 0 ? ` → ${fmt(r.viaDepart)}` : ""}
        </div>
      </div>
      <Endpoint label={r.toName} stop={r.to} color={color} isDot={false} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#6b7280" }}>Runs: {r.validDays.join(", ")}</span>
        {dur > 0 && (
          <span style={{ fontFamily: "monospace", fontSize: 12, color: "#8a92a3", background: "#12161f", padding: "3px 8px", borderRadius: 6 }}>~{dur} min</span>
        )}
      </div>
    </div>
  );
}

function TransferCard({ r }) {
  const colorA = ROUTE_COLOR[r.routeA] || "#8a92a3";
  const colorB = ROUTE_COLOR[r.routeB] || "#8a92a3";
  const dur =
    r.bTo.effMinutes !== null && r.aFrom.effMinutes !== null ? r.bTo.effMinutes - r.aFrom.effMinutes : null;
  const routeHeader = (label, trip, color) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, letterSpacing: 0.5, color, fontWeight: 600, textTransform: "uppercase" }}>
        {label} · {trip}
      </span>
    </div>
  );
  return (
    <div style={{ background: "#1a1f2b", border: "1px solid #2a3040", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <ArrowRightLeft size={13} color="#8a92a3" />
        <span style={{ fontSize: 13, letterSpacing: 1, color: "#8a92a3", fontWeight: 600, textTransform: "uppercase" }}>
          1 Transfer · via {r.hubName}
        </span>
      </div>

      {routeHeader(r.labelA, r.tripA, colorA)}
      <Endpoint label={r.fromName} stop={r.aFrom} color={colorA} isDot />
      <Endpoint label={r.hubName} stop={r.aTo} color={colorA} isDot={false} />

      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <span style={{ width: 10, display: "flex", justifyContent: "center", flexShrink: 0, color: "#6b7280" }}>
          <ArrowRightLeft size={12} />
        </span>
        <div style={{ fontSize: 12, color: "#8a92a3" }}>
          {r.wait > 0
            ? `Transfer at ${r.hubName} · ${r.wait} min wait`
            : `Timed transfer at ${r.hubName} — the buses meet`}
        </div>
      </div>

      {routeHeader(r.labelB, r.tripB, colorB)}
      <Endpoint label={r.hubName} stop={r.bFrom} color={colorB} isDot />
      <Endpoint label={r.toName} stop={r.bTo} color={colorB} isDot={false} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#6b7280" }}>Runs: {r.validDays.join(", ")}</span>
        {dur !== null && dur > 0 && (
          <span style={{ fontFamily: "monospace", fontSize: 12, color: "#8a92a3", background: "#12161f", padding: "3px 8px", borderRadius: 6 }}>~{dur} min</span>
        )}
      </div>
    </div>
  );
}

export default function TransitRoute() {
  const [origin, setOrigin] = useState("belleville");
  const [destination, setDestination] = useState("metro-picton");
  const [day, setDay] = useState("Any");

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const directResults = useMemo(() => {
    if (origin === destination) return [];
    const out = [];
    for (const trip of RESOLVED) {
      if (day !== "Any" && !trip.days.includes(day)) continue;
      const hit = findDirect(trip, origin, destination);
      if (!hit) continue;
      out.push({
        route: trip.route, label: trip.label, trip: trip.trip, runDays: trip.runDays,
        fromName: stopLabel(hit.from), toName: stopLabel(hit.to),
        from: hit.from, to: hit.to,
      });
    }
    out.sort((a, b) => (a.from.effMinutes ?? 1e9) - (b.from.effMinutes ?? 1e9));
    return out;
  }, [origin, destination, day]);

  const loopResults = useMemo(() => {
    if (origin === destination) return [];
    const out = [];
    for (const T of RESOLVED) {
      if (day !== "Any" && !T.days.includes(day)) continue;
      const ride = findLoopRide(T, origin, destination, day);
      if (!ride) continue;
      out.push({
        route: T.route, label: T.label,
        trip: `${ride.T.trip} → ${ride.T2.trip}`,
        fromName: stopLabel(ride.origin), toName: stopLabel(ride.dest),
        from: ride.origin, to: ride.dest,
        viaName: STOP_NAME[ride.T.lastId],
        viaArrive: ride.T.endMin, viaDepart: ride.T2.startMin,
        wait: ride.T2.startMin - ride.T.endMin,
        validDays: ride.T.days.filter((d) => ride.T2.days.includes(d)),
      });
    }
    // One row per distinct board/alight time on a route.
    const seen = new Set();
    const uniq = out.filter((r) => {
      const k = `${r.route}|${r.from.effMinutes}|${r.to.effMinutes}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    uniq.sort((a, b) => (a.from.effMinutes ?? 1e9) - (b.from.effMinutes ?? 1e9));
    return uniq;
  }, [origin, destination, day]);

  const transferResults = useMemo(() => {
    if (origin === destination) return [];
    const out = [];
    for (const tA of RESOLVED) {
      if (!HUB_ROUTES.has(tA.route)) continue;
      if (day !== "Any" && !tA.days.includes(day)) continue;
      const legA = findDirect(tA, origin, HUB_ID); // origin -> Bloomfield
      if (!legA) continue;
      const arr = legA.to.effMinutes ?? -Infinity;
      // Earliest connecting trip on the OTHER hub route that reaches the dest.
      let best = null;
      for (const tB of RESOLVED) {
        if (tB.route === tA.route || !HUB_ROUTES.has(tB.route)) continue;
        const common = tA.days.filter((d) => tB.days.includes(d) && (day === "Any" || d === day));
        if (!common.length) continue;
        const legB = findConnection(tB, HUB_ID, destination, arr); // Bloomfield -> dest
        if (!legB) continue;
        if (!best || legB.from.effMinutes < best.legB.from.effMinutes) best = { tB, legB, common };
      }
      if (!best) continue;
      out.push({
        routeA: tA.route, labelA: tA.label, tripA: tA.trip,
        routeB: best.tB.route, labelB: best.tB.label, tripB: best.tB.trip,
        fromName: stopLabel(legA.from), toName: stopLabel(best.legB.to), hubName: stopLabel(legA.to),
        aFrom: legA.from, aTo: legA.to, bFrom: best.legB.from, bTo: best.legB.to,
        wait: (best.legB.from.effMinutes ?? 0) - (legA.to.effMinutes ?? 0),
        validDays: best.common,
      });
    }
    const seen = new Set();
    const uniq = out.filter((r) => {
      const k = `${r.routeA}|${r.aFrom.effMinutes}|${r.routeB}|${r.bTo.effMinutes}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    uniq.sort((a, b) => (a.aFrom.effMinutes ?? 1e9) - (b.aFrom.effMinutes ?? 1e9));
    return uniq;
  }, [origin, destination, day]);

  const selectStyle = { width: "100%", background: "#1a1f2b", color: "#F5F1E8", border: "1px solid #2a3040", borderRadius: 8, padding: "10px 12px", fontSize: 14, cursor: "pointer" };
  const labelStyle = { fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#6b7280", marginBottom: 6, display: "block" };

  return (
    <div style={{ minHeight: "100%", background: "#12161f", color: "#F5F1E8", fontFamily: "sans-serif", padding: "28px 20px 60px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 20px" }}>Trip Planner</h1>

        <div style={{ background: "#181d28", border: "1px solid #2a3040", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}><MapPin size={11} style={{ verticalAlign: -1, marginRight: 4 }} />From</label>
              <select style={selectStyle} value={origin} onChange={(e) => setOrigin(e.target.value)}>
                {STOPS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button onClick={swap} aria-label="Swap" style={{ background: "#232838", border: "1px solid #2a3040", borderRadius: 8, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "#E8A33D", cursor: "pointer", flexShrink: 0, marginBottom: 1 }}>
              <ArrowRightLeft size={16} />
            </button>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}><MapPin size={11} style={{ verticalAlign: -1, marginRight: 4 }} />To</label>
              <select style={selectStyle} value={destination} onChange={(e) => setDestination(e.target.value)}>
                {STOPS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}><CalendarDays size={11} style={{ verticalAlign: -1, marginRight: 4 }} />Day of week</label>
            <select style={selectStyle} value={day} onChange={(e) => setDay(e.target.value)}>
              {DAYS.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
            </select>
          </div>
        </div>

        <div style={{ fontSize: 13, letterSpacing: 1, color: "#8a92a3", textTransform: "uppercase", marginBottom: 12 }}>
          {origin === destination
            ? "Pick two different stops"
            : directResults.length + loopResults.length + transferResults.length === 0
            ? "No trips found"
            : [
                directResults.length ? `${directResults.length} direct` : null,
                loopResults.length ? `${loopResults.length} loop-around` : null,
                transferResults.length ? `${transferResults.length} transfer` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
        </div>

        {origin !== destination && directResults.length + loopResults.length + transferResults.length === 0 && (
          <div style={{ background: "#181d28", border: "1px dashed #2a3040", borderRadius: 14, padding: "24px 20px", textAlign: "center", color: "#8a92a3", fontSize: 14, lineHeight: 1.6 }}>
            No way to make this trip on the selected day — not directly, around the loop, or with a transfer.
            <br />
            Try “Any day”, or check whether these stops are on the network.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {directResults.map((r, i) => <ResultCard key={i} r={r} />)}
        </div>

        {loopResults.length > 0 && (
          <>
            <div style={{ marginTop: directResults.length ? 24 : 0, marginBottom: 12, fontSize: 13, color: "#8a92a3", lineHeight: 1.5 }}>
              {directResults.length
                ? "Or ride the loop around (stay on past the turnaround):"
                : "No direct bus runs this way — but you can ride the loop around:"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {loopResults.map((r, i) => <LoopCard key={i} r={r} />)}
            </div>
          </>
        )}

        {transferResults.length > 0 && (
          <>
            <div style={{ marginTop: directResults.length || loopResults.length ? 24 : 0, marginBottom: 12, fontSize: 13, color: "#8a92a3", lineHeight: 1.5 }}>
              {directResults.length || loopResults.length
                ? "Or connect with 1 transfer at Bloomfield North:"
                : "No single bus makes this trip — connect with 1 transfer at Bloomfield North:"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {transferResults.map((r, i) => <TransferCard key={i} r={r} />)}
            </div>
          </>
        )}

        <div style={{ marginTop: 24, fontSize: 12, color: "#4a5265", lineHeight: 1.6, display: "flex", gap: 6 }}>
          <Clock size={13} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>A leading “~” means the time is estimated from the previous timed stop. “CALL AHEAD” stops only get served on request.</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#4a5265", lineHeight: 1.6, display: "flex", gap: 6 }}>
          <MapPin size={13} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>“Bloomfield North” and “Bloomfield South” are the same crossroads on opposite sides of the street — the planner picks the side facing your destination, so double-check which side the result shows.</span>
        </div>
      </div>
    </div>
  );
}
