import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { clipPath, constraint, parseProcedures, type Point, type Procedure } from "./procedure.js";
import type { AirspaceFile, Bounds } from "./airspace.js";
import { nm } from "./cifp.js";

// KPHX ILS RWY 25L from CIFP 2611, with its fixes.
const CIFP = String.raw`
SUSAEAENRT   POPKE K20    R   L N33110119W111563143                       E0096     NAR           POPKE                    473992605
SUSAEAENRT   ZERLO K20    C   L N33353739W111314276                       E0095     NAR           ZERLO                    551592605
SUSAP KPHXK2APHX     0     114YHN33260340W112004170E012001135         1800018000C    MNAR    PHOENIX SKY HARBOR INTL       877500903
SUSAP KPHXK2CBUDME K20    R     N33254171W111401045                       E0095     NAR           BUDME                    877682605
SUSAP KPHXK2CFIXAR K20    C     N33254064W111355595                       E0095     NAR           FIXAR                    877882605
SUSAP KPHXK2CGIPSE K20    C     N33254293W111484662                       E0096     NAR           GIPSE                    877952605
SUSAP KPHXK2CHAMEK K20    C     N33254231W111442854                       E0096     NAR           HAMEK                    877982403
SUSAP KPHXK2CSCADE K20    R     N33254347W111532120                       E0096     NAR           SCADE                    878482605
SUSAP KPHXK2GRW25L   0078002580 N33254384W112000554         +0313501126000049150IIRJG1                                     889111612
SUSAP KPHXK2FI25L  AZERLO 010ZERLOK2EA0E       IF                                             18000                 0 NS   887351202
SUSAP KPHXK2FI25L  AZERLO 020FIXARK2PC0E  A    TF                                 + 06000                           0 NS   887361310
SUSAP KPHXK2FI25L  AZERLO 030BUDMEK2PC0E       TF                                 + 05000                           0 NS   887371310
SUSAP KPHXK2FI25L  AZERLO 040HAMEKK2PC0EE B    CF IRJGK2      0780014525800036PI  + 04000                           0 NS   887382213
SUSAP KPHXK2FI25L  I      010HAMEKK2PC0E  I    IF IRJGK2      07800145        PI  J 040000300018000                 0 NS   887392213
SUSAP KPHXK2FI25L  I      011GIPSEK2PC0E       CF IRJGK2      0780010925800036PI  + 04000                           0 NS   887402213
SUSAP KPHXK2FI25L  I      020SCADEK2PC0E  F    CF IRJGK2      0780007125800038PI  H 0300003000            PXR   K2D 0 NS   887412107
SUSAP KPHXK2FI25L  I      030RW25LK2PG0GY M    CF IRJGK2      0780001425800056PI    01175             -300          0 NS   887421202
SUSAP KPHXK2FI25L  I      040         0  M     CA                     2580        + 03000                           0 NS   887431202
SUSAP KPHXK2FI25L  I      050         0    L   VIY                    1300                                          0 NS   887441202
SUSAP KPHXK2FI25L  I      060POPKEK2EA0EY      CF PXR K2      1626015016260030D   + 05000                           0 NS   887451202
SUSAP KPHXK2FI25L  I      070POPKEK2EA0EE  R   HM                     34260040    + 05000                           0 NS   887461202
`;

// KPHX FYRBD1 and SJN9 (runway 7L only) departures and the SUNSS8 arrival, CIFP 2611, with their fixes, navaids and
// runways.
const SIDSTAR = String.raw`
SUSAD        PXR   K2011560VTHW N33255886W111581273    N33255886W111581273E0120011842     NARPHOENIX                       257121809
SUSAD        SJN   K2011230VTHW N34252655W109083671    N34252655W109083671E0120068402     NARST JOHNS                      257912609
SUSAD        SSO   K2011540VTHW N32160928W109154712    N32160928W109154712E0130036002     NARSAN SIMON                     258142002
SUSAD        TUS   K2011600VTHW N32054273W110545348    N32054273W110545348E0120026712     NARTUCSON                        258751605
SUSAEAENRT   BAYBI K20    R     N32455723W111055017                       E0093     NAR           BAYBI                    285952403
SUSAEAENRT   FORPE K20    C   B N33411424W111160635                       E0094     NAR           FORPE                    355682605
SUSAEAENRT   HOTTT K20    C     N32313700W111015507                       E0092     NAR           HOTTT                    381502605
SUSAEAENRT   ITEMM K20    R   B N32351133W110352317                       E0091     NAR           ITEMM                    390172403
SUSAEAENRT   JUDTH K20    C   B N32485941W113411822                       E0100     NAR           JUDTH                    404542605
SUSAEAENRT   MOHAK K20    C   B N32463304W113581955                       E0101     NAR           MOHAK                    446272605
SUSAEAENRT   SQUEZ K20    C     N32595544W111235832                       E0094     NAR           SQUEZ                    500492605
SUSAEAENRT   SUNSS K20    R     N33030776W111280927                       E0094     NAR           SUNSS                    503392605
SUSAEAENRT   TELGE K20    R     N32403860W110585894                       E0092     NAR           TELGE                    507942605
SUSAP KPHXK2APHX     0     114YHN33260340W112004170E012001135         1800018000C    MNAR    PHOENIX SKY HARBOR INTL       877500903
SUSAP KPHXK2CAZCRD K20    W     N33233919W111501549                       E0096     NAR           AZCRD                    877572605
SUSAP KPHXK2CFUTEP K20    W     N33260574W111522224                       E0096     NAR           FUTEP                    877902605
SUSAP KPHXK2CFYRBD K20    W     N32572332W112402612                       E0098     NAR           FYRBD                    877912605
SUSAP KPHXK2CJUTAK K20    W     N33233228W112112751                       E0097     NAR           JUTAK                    878132605
SUSAP KPHXK2CMASVE K20    W     N33211874W111551132                       E0096     NAR           MASVE                    878202605
SUSAP KPHXK2COAKLI K20    W     N33215037W112005192                       E0096     NAR           OAKLI                    878252605
SUSAP KPHXK2CUSEYE K20    W     N33210154W111520658                       E0096     NAR           USEYE                    878682605
SUSAP KPHXK2CWETAL K20    W     N33172926W112091899                       E0097     NAR           WETAL                    878752403
SUSAP KPHXK2GRW07L   0103000780 N33255181W112013757         +0308501110000057150IIPHX1                                     889081903
SUSAP KPHXK2GRW07R   0078000780 N33254389W112013757         +0308801111000057150IIAHA1                                     889091612
SUSAP KPHXK2GRW08    0114890780 N33262709W112013666         +0309301113089855150IISYQ1                                     889101612
SUSAP KPHXK2GRW25L   0078002580 N33254384W112000554         +0313501126000049150IIRJG1                                     889111612
SUSAP KPHXK2GRW25R   0103002580 N33255173W111593604         +0315901134000055150R                                          889121903
SUSAP KPHXK2GRW26    0114892580 N33262696W111593169         +0316101135000055150IICWJ1                                     889131612
SUSAP KPHXK2DFYRBD14RW07B 010         0        VA                     0780        + 01635     18000                        880941806
SUSAP KPHXK2DFYRBD14RW07B 020FUTEPK2PC0E       DF                                                                          880951806
SUSAP KPHXK2DFYRBD14RW07B 030AZCRDK2PC0E       TF                                                                          880961806
SUSAP KPHXK2DFYRBD14RW07B 040USEYEK2PC0E       TF                                                                          880971806
SUSAP KPHXK2DFYRBD14RW07B 050MASVEK2PC0E       TF                                 + 07000          220               -     880981806
SUSAP KPHXK2DFYRBD14RW07B 060OAKLIK2PC0E       TF                                                                          880991806
SUSAP KPHXK2DFYRBD14RW07B 070FYRBDK2PC0EE      TF                                                                          881001806
SUSAP KPHXK2DFYRBD14RW08  010         0        VA                     0781        + 01635     18000                        881011806
SUSAP KPHXK2DFYRBD14RW08  020FUTEPK2PC0E       DF                                                                          881021806
SUSAP KPHXK2DFYRBD14RW08  030AZCRDK2PC0E       TF                                                                          881031806
SUSAP KPHXK2DFYRBD14RW08  040USEYEK2PC0E       TF                                                                          881041806
SUSAP KPHXK2DFYRBD14RW08  050MASVEK2PC0E       TF                                 + 07000          220               -     881051806
SUSAP KPHXK2DFYRBD14RW08  060OAKLIK2PC0E       TF                                                                          881061806
SUSAP KPHXK2DFYRBD14RW08  070FYRBDK2PC0EE      TF                                                                          881071806
SUSAP KPHXK2DFYRBD14RW25L 010         0        VI                     2581                    18000                        881081806
SUSAP KPHXK2DFYRBD14RW25L 020JUTAKK2PC0E       CF PXR K2      2457011424000071D                                            881091806
SUSAP KPHXK2DFYRBD14RW25L 030WETALK2PC0EY      TF                                                                          881101806
SUSAP KPHXK2DFYRBD14RW25L 040FYRBDK2PC0EE      TF                                                                          881111806
SUSAP KPHXK2DFYRBD14RW25R 010         0        VI                     2581                    18000                        881121806
SUSAP KPHXK2DFYRBD14RW25R 020JUTAKK2PC0E       CF PXR K2      2457011424000075D                                            881131806
SUSAP KPHXK2DFYRBD14RW25R 030WETALK2PC0EY      TF                                                                          881141806
SUSAP KPHXK2DFYRBD14RW25R 040FYRBDK2PC0EE      TF                                                                          881151806
SUSAP KPHXK2DFYRBD14RW26  010         0        VA                     2581        + 01635     18000                        881161806
SUSAP KPHXK2DFYRBD14RW26  020JUTAKK2PC0E       DF                                                                          881171806
SUSAP KPHXK2DFYRBD14RW26  030WETALK2PC0EY      TF                                                                          881181806
SUSAP KPHXK2DFYRBD14RW26  040FYRBDK2PC0EE      TF                                                                          881191806
SUSAP KPHXK2DFYRBD15      010FYRBDK2PC0E       IF                                             18000                        881201806
SUSAP KPHXK2DFYRBD15      020JUDTHK2EA0EE      TF                                                                          881211806
SUSAP KPHXK2DFYRBD16MOHAK 010JUDTHK2EA0E       IF                                             18000                        881221806
SUSAP KPHXK2DFYRBD16MOHAK 020MOHAKK2EA0EE      TF                                                                          881231806
SUSAP KPHXK2DSJN9  1RW07L 010         0        VA                     0780        + 01550     18000                        882701903
SUSAP KPHXK2DSJN9  1RW07L 020         0        VD PXR K2              07500040D                                            882711903
SUSAP KPHXK2DSJN9  1RW07L 030         0        VI                     0450                                                 882721903
SUSAP KPHXK2DSJN9  1RW07L 040FORPEK2EA0E       CF PXR K2      0544038305400280D                                            882731903
SUSAP KPHXK2DSJN9  1RW07L 050SJN  K2D 0VE      TF                                                                          882741903
SUSAP KPHXK2ESUNSS81SSO   010SSO  K2D 0V       IF                                             18000                        886891705
SUSAP KPHXK2ESUNSS81SSO   020ITEMMK2EA0E       TF                                                                          886902103
SUSAP KPHXK2ESUNSS81SSO   030TELGEK2EA0E       TF                                                                          886911705
SUSAP KPHXK2ESUNSS81SSO   040BAYBIK2EA0EE      TF                                                                          886922103
SUSAP KPHXK2ESUNSS81TUS   010TUS  K2D 0V       IF                                             18000                        886931705
SUSAP KPHXK2ESUNSS81TUS   020HOTTTK2EA0E       TF                                                                          886941705
SUSAP KPHXK2ESUNSS81TUS   030BAYBIK2EA0EE      TF                                                                          886952103
SUSAP KPHXK2ESUNSS82ALL   010BAYBIK2EA0E       IF                                             18000                        886962103
SUSAP KPHXK2ESUNSS82ALL   020SQUEZK2EA0E       TF                                                                          886972103
SUSAP KPHXK2ESUNSS82ALL   030SUNSSK2EA0EY      TF                                                                          886981705
SUSAP KPHXK2ESUNSS82ALL   040KPHX K2PA0AE      VM                     2900                                                 886991705
`;
const WIDE: Bounds = { s: 31, w: -114, n: 35, e: -110 };
const near = (a: number[], lat: number, lon: number, within = 0.05) => assert.ok(nm(a[0], a[1], lat, lon) < within, `${a} is not near ${lat},${lon}`);
const ils = (b = WIDE) => parseProcedures(CIFP, b).procedures.find((p) => p.name === "ILS RWY 25L");
const seg = (p: Procedure, s: string) => p.paths.filter((x) => x.seg === s);
const bearing = (p: number[], q: number[]) => ((Math.atan2((q[1] - p[1]) * Math.cos((p[0] * Math.PI) / 180), q[0] - p[0]) * 180) / Math.PI + 360) % 360;

test("ILS 25L: published fixes, altitudes, roles and final numbers", () => {
  const a = ils()!;
  assert.equal(a.type, "IAP");
  assert.equal(a.airport, "KPHX");
  const fix = (n: string) => a.fixes.find((f) => f.name === n)!;
  assert.equal(fix("SCADE").role, "FAF");
  assert.equal(fix("SCADE").alt, "3000");
  assert.equal(fix("SCADE").seg, "final");
  assert.equal(fix("RW25L").role, "MAP");
  assert.equal(fix("HAMEK").role, "IF");
  assert.equal(fix("FIXAR").seg, "transition");
  assert.equal(fix("POPKE").seg, "missed");
  assert.equal(a.course, 258);
  assert.equal(a.glidepath, 3);
  assert.ok(a.fafToMap! > 5 && a.fafToMap! < 6.5);
});

test("ILS 25L missed: climb on course, heading to the intercept, then the fix and a right-hand hold", () => {
  const a = ils()!;
  const [final] = seg(a, "final"), [missed] = seg(a, "missed");
  const m = missed.pts;
  assert.deepEqual(m[0], final.pts[final.pts.length - 1]);
  // Climb to 3,000 on 258 magnetic, which is due west here with 12E variation.
  assert.equal(m[1][2], 3000);
  assert.ok(Math.abs(m[1][0] - m[0][0]) < 0.005 && m[1][1] < m[0][1]);
  // Heading 130 magnetic runs southeast to the 162.6 course into POPKE; the climb to 5,000 spreads over the way.
  assert.ok(m[2][0] < m[1][0] && m[2][1] > m[1][1]);
  assert.ok(m[2][2] > 3000 && m[2][2] < 5000);
  assert.ok(Math.abs(bearing(m[2], m[3]) - 174.6) < 2, `course into POPKE ${bearing(m[2], m[3])}`);
  near(m[3], 33.18366, -111.94206);
  assert.equal(m[3][2], 5000);
  // Inbound 342.6 magnetic is nearly north, so the outbound leg lies south and right turns put it east of the fix.
  const hold = m.slice(4);
  assert.ok(hold.every((p) => p[1] >= m[3][1] - 0.001));
  assert.ok(Math.min(...hold.map((p) => p[0])) < m[3][0] - 3.5 / 60);
  near(hold[hold.length - 1], m[3][0], m[3][1]);
});

test("paths that leave the chart are cut at its edge; nothing on the chart, no procedure", () => {
  const east: Bounds = { ...WIDE, e: -111.65 };
  const a = ils(east)!;
  const t = seg(a, "transition").flatMap((p) => p.pts);
  assert.ok(t.length >= 2 && t.every((p) => p[1] <= east.e));
  assert.ok(t.some((p) => Math.abs(p[1] - east.e) < 1e-4), "cut exactly at the edge");
  assert.equal(a.fixes.some((f) => f.name === "FIXAR"), false);
  const north: Bounds = { ...WIDE, s: 33.3 };
  const b = ils(north)!;
  assert.ok(seg(b, "missed").every((p) => p.pts.length >= 2 && p.pts.every((q) => q[0] >= 33.3)));
  assert.equal(b.fixes.some((f) => f.name === "POPKE"), false);
  assert.equal(ils({ ...WIDE, s: 34 }), undefined);
});

test("clipping a path that leaves and comes back gives two pieces, heights cut in proportion", () => {
  const b: Bounds = { s: 0, w: 0, n: 1, e: 1 };
  const pts: Point[] = [[0.5, 0.2, 1000], [0.5, 1.5, 2300], [0.5, 1.6, 2400], [0.6, 0.8, 3000]];
  const cut = clipPath(pts, b);
  assert.equal(cut.length, 2);
  assert.deepEqual(cut[0], [[0.5, 0.2, 1000], [0.5, 1, 1800]]);
  assert.deepEqual(cut[1][0].slice(0, 2), [0.575, 1]);
});

test("altitude constraints as the chart gives them, flight levels and windows included", () => {
  const line = (desc: string, a1: string, a2 = "") => " ".repeat(82) + desc + " " + a1.padEnd(5) + a2.padEnd(5);
  assert.deepEqual(constraint(line("+", "07000")), { alt: "7000+", ft: 7000 });
  assert.deepEqual(constraint(line("-", "FL330")), { alt: "FL330-", ft: 33000 });
  assert.deepEqual(constraint(line("B", "FL300", "FL240")), { alt: "FL240 to FL300", ft: 24000 });
  assert.deepEqual(constraint(line("B", "14000", "13000")), { alt: "13000 to 14000", ft: 13000 });
  assert.deepEqual(constraint(line(" ", "")), { alt: null, ft: null });
});

test("FYRBD1: RW07B starts from both 7s' departure ends; runway 25L heads out to intercept the course to JUTAK", () => {
  const { airports, procedures } = parseProcedures(SIDSTAR, WIDE);
  const sid = procedures.find((p) => p.type === "SID" && p.name === "FYRBD1")!;
  const rwy = Object.fromEntries(SIDSTAR.split("\n").filter((l) => l.startsWith("SUSAP KPHXK2G")).map((l) => [l.slice(13, 18).trim(), l]));
  const at = (l: string) => [l.slice(32, 41), l.slice(41, 51)].map((s) => { const n = s.length - 6; const v = Number(s.slice(1, n)) + Number(s.slice(n, n + 2)) / 60 + Number(s.slice(n + 2)) / 360000; return s[0] === "W" ? -v : v; });
  const trans = seg(sid, "transition").map((p) => p.pts);
  // Runway 7L departs from the far end, the runway 25R threshold, climbing on 078 to 1,635 before going direct.
  const from7L = trans.find((p) => nm(p[0][0], p[0][1], at(rwy.RW25R)[0], at(rwy.RW25R)[1]) < 0.01)!;
  assert.ok(from7L, "a path starts at the 7L departure end");
  assert.equal(from7L[1][2], 1635);
  assert.ok(Math.abs(bearing(from7L[0], from7L[1]) - 90) < 3, `078 magnetic is about 090 true, got ${bearing(from7L[0], from7L[1])}`);
  assert.ok(trans.some((p) => nm(p[0][0], p[0][1], at(rwy.RW25L)[0], at(rwy.RW25L)[1]) < 0.01), "and one at the 7R departure end");
  // Runway 25L: heading 258.1 until the 240 course into JUTAK, from the 7R threshold.
  const from25L = trans.find((p) => nm(p[0][0], p[0][1], at(rwy.RW07R)[0], at(rwy.RW07R)[1]) < 0.01)!;
  const jutak = sid.fixes.find((f) => f.name === "JUTAK")!;
  near(from25L[2], jutak.lat, jutak.lon);
  assert.ok(Math.abs(bearing(from25L[1], from25L[2]) - 252) < 3, `240 magnetic into JUTAK, got ${bearing(from25L[1], from25L[2])}`);
  assert.equal(seg(sid, "common").length, 1);
  // Heights climb from the field and never drop below it.
  assert.ok(sid.paths.every((p) => p.pts.every((q) => q[2] >= 1100)));
  assert.deepEqual(airports.map((a) => a.id), ["KPHX"]);
  assert.ok(airports[0].procedures.some((p) => p.type === "STAR" && p.name === "SUNSS8"));
});

test("SJN9 runway 7L: heading to 4 DME from PXR, then heading 045 to intercept", () => {
  const sid = parseProcedures(SIDSTAR, WIDE).procedures.find((p) => p.name === "SJN9")!;
  const [path] = seg(sid, "transition").map((p) => p.pts);
  const pxr = [33 + 25 / 60 + 58.8 / 3600, -(111 + 58 / 60 + 13 / 3600)];
  const pxrLine = SIDSTAR.split("\n").find((l) => l.startsWith("SUSAD        PXR"))!;
  const c = (s: string) => { const n = s.length - 6; const v = Number(s.slice(1, n)) + Number(s.slice(n, n + 2)) / 60 + Number(s.slice(n + 2)) / 360000; return s[0] === "W" ? -v : v; };
  pxr[0] = c(pxrLine.slice(32, 41)); pxr[1] = c(pxrLine.slice(41, 51));
  // Departure end, climb to 1,550 on 078, then on to the 4 DME arc.
  assert.equal(path[1][2], 1550);
  assert.ok(Math.abs(nm(path[2][0], path[2][1], pxr[0], pxr[1]) - 4) < 0.05, `${nm(path[2][0], path[2][1], pxr[0], pxr[1])} NM from PXR`);
});

test("SUNSS8: enroute transitions in from off the chart, common route ending in vectors heading 290", () => {
  const bounds: Bounds = { s: 32.9, w: -112.75, n: 34, e: -111.3 };
  const star = parseProcedures(SIDSTAR, bounds).procedures.find((p) => p.name === "SUNSS8")!;
  assert.equal(star.type, "STAR");
  const [common] = seg(star, "common").map((p) => p.pts);
  const sunss = star.fixes.find((f) => f.name === "SUNSS")!;
  const end = common[common.length - 1];
  // 2.5 NM of vectors past SUNSS, on 290 magnetic (about 302 true).
  assert.ok(Math.abs(nm(sunss.lat, sunss.lon, end[0], end[1]) - 2.5) < 0.1);
  assert.ok(Math.abs(bearing([sunss.lat, sunss.lon], end) - 302) < 3);
  // The TUS and SSO transitions end at BAYBI, off the chart to the southeast, so they don't show; the common route
  // comes in across the chart's east edge.
  assert.equal(seg(star, "transition").length, 0);
  assert.ok(Math.abs(common[0][1] - bounds.e) < 1e-4);
  assert.deepEqual(star.fixes.map((f) => f.name), ["SQUEZ", "SUNSS"]);
  // Then vectors from the end of the vectors leg down to the field.
  const [v] = seg(star, "vectors").map((p) => p.pts);
  assert.deepEqual(v[0], end);
  const apt = parseProcedures(SIDSTAR, bounds).airports[0];
  near(v[1], apt.lat, apt.lon, 0.01);
  assert.equal(v[1][2], apt.elev);
});

// KIWA RNAV (RNP) Z RWY 30C (radius-to-fix arcs) and ILS RWY 30C from the IWA transition (procedure turn at SNOWL),
// CIFP 2611.
const IWA = String.raw`
SUSAD        IWA   K2011330VTLW N33181141W111390517    N33181141W111390517E0130013671     NARWILLIE                        254072106
SUSAEAENRT   GICGE K20    C   L N32574137W111425302                       E0095     NAR           GICGE                    361252605
SUSAEAENRT   TYLIK K20    W     N33181963W111283538                       E0095     NAR           TYLIK                    515532403
SUSAP KIWAK2AIWA     0     104YHN33182817W111391965E013001384         1800018000C    MNAR    MESA GATEWAY                  278352502
SUSAP KIWAK2CALIEE K20    W     N33134084W111303808                       E0095     NAR           ALIEE                    278372403
SUSAP KIWAK2CCFRFS K20    A     N33161850W111315894                       E0095     NAR           CFRFS(CNF)               278402403
SUSAP KIWAK2CGYANT K20    W     N33161941W111283458                       E0094     NAR           GYANT                    278442605
SUSAP KIWAK2CIVVRY K20    R     N33073476W111263563                       E0094     NAR           IVVRY                    278462605
SUSAP KIWAK2COTRRR K20    W     N33141845W111342501                       E0095     NAR           OTRRR                    278522605
SUSAP KIWAK2CSNOWL K20    C     N33134198W111334255                       E0095     NAR           SNOWL                    278552403
SUSAP KIWAK2CWOBOY K20    R     N33035975W111222671                       E0094     NAR           WOBOY                    278562605
SUSAP KIWAK2GRW12C   0102011230 N33190341W111395732         +0381101348000050150R                                          281332208
SUSAP KIWAK2GRW12L   0093001230 N33190332W111394073         +0383701356000074150V                                          281341612
SUSAP KIWAK2GRW12R   0104011230 N33190362W111402233         +0379001341000045150R                                          281352208
SUSAP KIWAK2GRW30C   0102013030 N33175134W111383319         +0391101381000041150IIIWA1                                     281362310
SUSAP KIWAK2GRW30L   0104013030 N33175014W111385653         +0389101374000055150R                                          281372208
SUSAP KIWAK2GRW30R   0093003030 N33175761W111382403         +0392201384000055150R                                          281382208
SUSAP KIWAK2FH30CZ ATYLIK 010TYLIKK2EA0E  A    IF                                             18000                 A FS   280121206
SUSAP KIWAK2FH30CZ ATYLIK 020GYANTK2PC0EE B 010TF                                 + 03200          180              A-FS   280131710
SUSAP KIWAK2FH30CZ H      010GYANTK2PC0E  I    IF                                 + 03200     18000180    RW30C K2PGA-FS   280141310
SUSAP KIWAK2FH30CZ H      011ALIEEK2PC0E   R010RF       0028601667    23360033    B 0400003000            CFRFS K2PCA FS   280152310
SUSAP KIWAK2FH30CZ H      020OTRRRK2PC1E  FR010RF       0028602336    30260034    + 03000                 CFRFS K2PCA FS   280162310
SUSAP KIWAK2FH30CZ H      030RW30CK2PG0GY M 031TF                                   01423             -300          A FS   280182310
SUSAP KIWAK2FH30CZ H      040         0  M     CA                     3026        + 02800                           A FS   280191206
SUSAP KIWAK2FH30CZ H      050GICGEK2EA0EY  L010DF                                 + 05000                           A FS   280201710
SUSAP KIWAK2FH30CZ H      060GICGEK2EA0EE  L   HM                     32240050    + 05000                           A FS   280211206
SUSAP KIWAK2FI30C  AIWA   010IWA  K2D 0V       IF                                             18000                 0 NS   280221308
SUSAP KIWAK2FI30C  AIWA   020SNOWLK2PC0E       TF                                 + 04400                           0 NS   280231310
SUSAP KIWAK2FI30C  AIWA   030SNOWLK2PC0EE AL   PI IIWAK2      1226007716760100PI  + 03700                           0 NS   280242310
SUSAP KIWAK2FI30C  I      010WOBOYK2PC0E  I    IF IIWAK2      12260212        PI  J 060000330018000                 0 NS   280352310
SUSAP KIWAK2FI30C  I      011IVVRYK2PC0E       CF IIWAK2      1226016330300050PI  + 05000                           0 NS   280362310
SUSAP KIWAK2FI30C  I      020SNOWLK2PC0E  F    CF IIWAK2      1226007730300085PI  H 0330003300            IWA   K2D 0 NS   280372106
SUSAP KIWAK2FI30C  I      030RW30CK2PG0GY M    CF IIWAK2      1226001930300058PI    01422             -300          0 NS   280382310
SUSAP KIWAK2FI30C  I      040         0  M     CA                     3026        + 02800                           0 NS   280391308
SUSAP KIWAK2FI30C  I      050         0    R   VIY                    1450                                          0 NS   280401308
SUSAP KIWAK2FI30C  I      060IWA  K2D 0VY      CF IWA K2      0000000019500020D   + 05000                           0 NS   280411308
SUSAP KIWAK2FI30C  I      070IWA  K2D 0VE  R   HM                     3600T010    + 05000                           0 NS   280421308
`;

test("RNAV (RNP) Z 30C: GYANT to OTRRR is an arc around CFRFS, every point at the same radius", () => {
  const rnp = parseProcedures(IWA, WIDE).procedures.find((p) => p.name === "RNAV (RNP) Z RWY 30C")!;
  const line = IWA.split("\n").find((l) => l.startsWith("SUSAP KIWAK2CCFRFS"))!;
  const c = (s: string) => { const n = s.length - 6; const v = Number(s.slice(1, n)) + Number(s.slice(n, n + 2)) / 60 + Number(s.slice(n + 2)) / 360000; return s[0] === "W" ? -v : v; };
  const [clat, clon] = [c(line.slice(32, 41)), c(line.slice(41, 51))];
  const [final] = seg(rnp, "final").map((p) => p.pts);
  const fix = (n: string) => rnp.fixes.find((f) => f.name === n)!;
  const i = final.findIndex((p) => nm(p[0], p[1], fix("GYANT").lat, fix("GYANT").lon) < 0.01);
  const j = final.findIndex((p) => nm(p[0], p[1], fix("OTRRR").lat, fix("OTRRR").lon) < 0.01);
  assert.ok(i >= 0 && j > i + 3, `arc from ${i} to ${j}`);
  const r = final.slice(i, j + 1).map((p) => nm(p[0], p[1], clat, clon));
  assert.ok(Math.max(...r) - Math.min(...r) < 0.05, `radius ${Math.min(...r)} to ${Math.max(...r)}`);
});

test("ILS 30C from IWA: a procedure turn at SNOWL, out southeast, the 45 degree leg south, back to the inbound course", () => {
  const ils = parseProcedures(IWA, WIDE).procedures.find((p) => p.name === "ILS RWY 30C")!;
  const snowl = ils.fixes.find((f) => f.name === "SNOWL")!;
  const t = seg(ils, "transition").map((p) => p.pts).find((p) => p.length > 3)!;
  const at = t.findIndex((p) => nm(p[0], p[1], snowl.lat, snowl.lon) < 0.01);
  const [out, leg] = [t[at + 1], t[at + 2]];
  assert.ok(Math.abs(bearing([snowl.lat, snowl.lon], out) - 134.6) < 3, `outbound ${bearing([snowl.lat, snowl.lon], out)}`);
  assert.ok(Math.abs(bearing(out, leg) - 179.6) < 3, `45 degree leg ${bearing(out, leg)}`);
  // The turn back is to the left, which is east of a southbound leg, and the path ends on the inbound course.
  assert.ok(t[at + 3][1] > leg[1]);
  const end = t[t.length - 1];
  assert.ok(Math.abs(bearing([snowl.lat, snowl.lon], end) - 134.6) < 3, `back on the inbound course line, ${bearing([snowl.lat, snowl.lon], end)}`);
  assert.ok(t.slice(at).every((p) => p[2] === 3700));
});

// KCHD BNYRD6, CIFP 2611: the coded route starts at BNYRD; the chart says radar vectors from the runway.
const CHD = String.raw`
SUSAP KCHDK2ACHD     0     048YHN33160875W111484004E012001243         1800018000C    MNAR    CHANDLER MUNI                 484072106
SUSAEAENRT   BNYRD K20    W     N32595324W111575915                       E0096     NAR           BNYRD                    292162403
SUSAD        TFD   K2011480VTH  N32530908W111543144    N32530908W111543144E0120013162     NARSTANFIELD                     258511605
SUSAD        TUS   K2011600VTHW N32054273W110545348    N32054273W110545348E0120026712     NARTUCSON                        258751605
SUSAP KCHDK2DBNYRD65ALL   010BNYRDK2EA0E       IF                                             18000                        484151806
SUSAP KCHDK2DBNYRD65ALL   020TFD  K2D 0VE      TF                                                                          484161806
SUSAP KCHDK2DBNYRD66TUS   010TFD  K2D 0V       IF                                             18000                        484171806
SUSAP KCHDK2DBNYRD66TUS   020TUS  K2D 0VE      TF                                                                          484181806
`;

test("BNYRD6 from KCHD: vectors from the field to BNYRD, where the coded route starts", () => {
  const { airports, procedures } = parseProcedures(CHD, WIDE);
  const sid = procedures.find((p) => p.name === "BNYRD6")!;
  const chd = airports.find((a) => a.id === "KCHD")!;
  const [v] = seg(sid, "vectors").map((p) => p.pts);
  const bnyrd = sid.fixes.find((f) => f.name === "BNYRD")!;
  near(v[0], chd.lat, chd.lon, 0.01);
  assert.equal(v[0][2], chd.elev);
  near(v[1], bnyrd.lat, bnyrd.lon, 0.01);
  assert.deepEqual(v[1], seg(sid, "common")[0].pts[0]);
  // FYRBD1 leaves from the runways, so it gets no vectors.
  assert.equal(seg(parseProcedures(SIDSTAR, WIDE).procedures.find((p) => p.name === "FYRBD1")!, "vectors").length, 0);
});

test("built data: procedures for every airport on the chart, all inside it, with terrain of the right size", () => {
  const f: AirspaceFile = JSON.parse(readFileSync(new URL("../data/phoenix/area.json", import.meta.url), "utf8"));
  const phx = f.airports.find((a) => a.id === "KPHX")!;
  const count = (t: string) => phx.procedures.filter((p) => p.type === t).length;
  assert.equal(count("IAP"), 16);
  assert.ok(count("SID") >= 10 && count("STAR") >= 8, `${count("SID")} SIDs, ${count("STAR")} STARs`);
  assert.ok(f.airports.length >= 10);
  for (const a of f.airports) {
    const url = new URL(`../data/phoenix/procedures/${a.id}.json`, import.meta.url);
    assert.ok(existsSync(url), a.id);
    const procs: Procedure[] = JSON.parse(readFileSync(url, "utf8"));
    assert.deepEqual(procs.map((p) => p.name), a.procedures.map((p) => p.name));
    for (const p of procs) {
      assert.ok(p.paths.length && p.paths.every((x) => x.pts.length >= 2), `${a.id} ${p.name}`);
      assert.ok(p.paths.every((x) => x.pts.every(([la, lo]) => la >= f.bounds.s - 1e-4 && la <= f.bounds.n + 1e-4 && lo >= f.bounds.w - 1e-4 && lo <= f.bounds.e + 1e-4)), `${a.id} ${p.name}`);
      if (p.type === "IAP") assert.ok(p.fixes.some((x) => x.role === "MAP") || p.paths.some((x) => x.seg === "final"), p.name);
    }
  }
  const dem = readFileSync(new URL(`../data/phoenix/${f.dem.url}`, import.meta.url));
  assert.equal(dem.length, f.dem.nx * f.dem.ny * 2);
  const ft = new Int16Array(dem.buffer, dem.byteOffset, dem.length / 2);
  // Lowest and highest ground in the Phoenix area, in feet.
  assert.ok(Math.min(...ft) > 300 && Math.min(...ft) < 1100 && Math.max(...ft) > 6000 && Math.max(...ft) < 9000);
});
