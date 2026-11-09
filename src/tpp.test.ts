import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { airportBlock, approachMatches, chartGroups, chartRecords, codesIn, noChart, pageFile, pageTurn, proceduresOn } from "./tpp.js";

const rec = (code: string, name: string, pdf: string, action = "") => `<record><chart_code>${code}</chart_code><chart_name>${name}</chart_name><useraction>${action}</useraction><pdf_name>${pdf}</pdf_name></record>`;
const META = `<airport_name ID="PHOENIX SKY HARBOR INTL" apt_ident="PHX" icao_ident="KPHX">` +
  rec("APD", "AIRPORT DIAGRAM", "00322AD.PDF") + rec("IAP", "ILS OR LOC RWY 07R", "00322IL7R.PDF") +
  rec("DP", "BUCKEYE FOUR, CONT.1", "00322BUCKEYE_C.PDF") + rec("DP", "BUCKEYE FOUR", "00322BUCKEYE.PDF") +
  rec("STR", "EAGUL SIX", "00322EAGUL.PDF") + rec("IAP", "VOR RWY 26", "DELETED_JOB.PDF", "D") +
  `<airport_name ID="SCOTTSDALE" apt_ident="SDL" icao_ident="KSDL">` + rec("IAP", "VOR/DME-A", "00860VDA.PDF");
const AIRPORTS: { id: string; procedures: { type: "IAP" | "SID" | "STAR"; name: string }[] }[] = JSON.parse(readFileSync("data/phoenix/area.json", "utf8")).airports;
const KPHX = AIRPORTS.find((a) => a.id === "KPHX")!.procedures;

test("records by airport; continuation pages fold in, first page first; deleted and other charts left out", () => {
  assert.equal(chartRecords(airportBlock(META, "KPHX")!).length, 6);
  assert.deepEqual(chartGroups(chartRecords(airportBlock(META, "KPHX")!)), [
    { kind: "IAP", name: "ILS OR LOC RWY 07R", pdfs: ["00322IL7R.PDF"] },
    { kind: "DP", name: "BUCKEYE FOUR", pdfs: ["00322BUCKEYE.PDF", "00322BUCKEYE_C.PDF"] },
    { kind: "STR", name: "EAGUL SIX", pdfs: ["00322EAGUL.PDF"] },
  ]);
  assert.equal(airportBlock(META, "SDL")?.includes("00860VDA.PDF"), true);
  assert.equal(pageFile("00322IL7R.PDF"), "00322il7r.png");
});
test("approaches match on type and runway", () => {
  assert.deepEqual(proceduresOn("IAP", "ILS OR LOC RWY 07R", "", KPHX), ["ILS RWY 07R", "LOC RWY 07R"]);
  assert.deepEqual(proceduresOn("IAP", "RNAV (GPS) Y RWY 08", "", KPHX), ["RNAV (GPS) Y RWY 08"]);
  assert.deepEqual(proceduresOn("IAP", "ILS OR LOC/DME RWY 07L", "", KPHX), ["ILS RWY 07L", "LOC RWY 07L"]);
  assert.equal(approachMatches("LOC/DME RWY 21", "LOC RWY 21"), true);
  assert.equal(approachMatches("RNAV (GPS) RWY 3", "RNAV (GPS) RWY 03"), true);
  assert.equal(approachMatches("ILS Z OR LOC Z RWY 09", "LOC Z RWY 09"), true);
  assert.equal(approachMatches("VOR/DME-A", "VOR/DME-A"), true);
  assert.equal(approachMatches("RNAV (GPS)-B", "RNAV (GPS)-E"), false);
  assert.equal(approachMatches("RNAV (GPS) Y RWY 08", "RNAV (GPS) Z RWY 08"), false);
  assert.equal(approachMatches("LOC RWY 25", "LOC BC RWY 25"), false);
  for (const t of ["ILS", "LOC", "LOC BC", "RNAV (GPS)", "RNAV (RNP)", "GPS", "VOR", "VOR/DME", "NDB", "NDB/DME", "LDA", "SDF", "TACAN"])
    assert.equal(approachMatches(`${t} RWY 12`, `${t} RWY 12`), true, t); // every type src/cifp.ts names
});
test("departures and arrivals match on the computer code", () => {
  assert.deepEqual(codesIn("BUCKEYE FOUR DEPARTURE ( BXK4 . BXK ) ... (BLH.EAGUL6)"), ["BXK4", "BXK", "BLH", "EAGUL6"]);
  assert.deepEqual(proceduresOn("DP", "BUCKEYE FOUR", "TAKEOFF ... (BXK4.BXK)", KPHX), ["BXK4"]);
  assert.deepEqual(proceduresOn("STR", "EAGUL SIX", "(EAGUL6.EAGUL) BLYTHE TRANSITION (BLH.EAGUL6)", KPHX), ["EAGUL6"]);
});
test("a chart with no procedure (a charted visual, synthetic: 2611 has none here) matches nothing; a procedure with no chart is named", () => {
  assert.deepEqual(proceduresOn("IAP", "RIVER VISUAL RWY 19", "", KPHX), []);
  const entries = [{ name: "BUCKEYE FOUR", kind: "DP" as const, pages: [], procedures: ["BXK4"] }];
  assert.deepEqual(noChart(entries, [{ name: "BXK4" }, { name: "TFD4" }]), ["TFD4"]);
});
test("a graphic obstacle departure is a departure, matched by its code", () => {
  const block = `<airport_name ID="PHOENIX DEER VALLEY" apt_ident="DVT" icao_ident="KDVT">` +
    rec("ODP", "DEER VALLEY THREE (OBSTACLE)", "06646DEERVALLEY.PDF") + rec("ODP", "DEER VALLEY THREE (OBSTACLE), CONT.1", "06646DEERVALLEY_C.PDF");
  assert.deepEqual(chartGroups(chartRecords(block)), [{ kind: "DP", name: "DEER VALLEY THREE (OBSTACLE)", pdfs: ["06646DEERVALLEY.PDF", "06646DEERVALLEY_C.PDF"] }]);
  // 2611's 06646DEERVALLEY.PDF, page 1 text.
  assert.deepEqual(proceduresOn("DP", "DEER VALLEY THREE (OBSTACLE)", "(DVT3.PXR) DEER VALLEY THREE DEPARTURE", AIRPORTS.find((a) => a.id === "KDVT")!.procedures), ["DVT3"]);
});
test("a page whose text mostly runs sideways is turned to read left to right", () => {
  const item = (str: string, a: number, b: number) => ({ str, transform: [a, b, -b, a, 0, 0] });
  const side = "EAGUL SIX ARRIVAL NOTE: RADAR required. GALLUP TRANSITION (GUP.EAGUL6)";
  assert.equal(pageTurn([item("ILS or LOC RWY 7R PHOENIX SKY HARBOR INTL", 9, 0), item("SW-4, 29 OCT 2026", 0, 9)]), 0);
  assert.equal(pageTurn([item("(EAGUL.EAGUL6)", 9, 0), item(side, 0, 9), item("SW-4", 0, -9)]), 90); // bottom to top, as EAGUL SIX page 1
  assert.equal(pageTurn([item("(EAGUL.EAGUL6)", 9, 0), item(side, 0, -9)]), 270); // top to bottom
  // A page drawn as outlines (2611's Luke AFB charts) has only the date strips down both margins, one each way.
  assert.equal(pageTurn([item("SW-4, 29 OCT 2026 to 26 NOV 2026", 0, 9), item("SW-4, 29 OCT 2026 to 26 NOV 2026", 0, -9)]), 0);
});
