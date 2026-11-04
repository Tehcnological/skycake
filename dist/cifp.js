// Shared pieces of the FAA CIFP (ARINC 424-18, 132 columns): fix positions, approach names, fix roles, distances.
/** Distance in NM, flat-earth: fine across one chart. */
export function nm(lat1, lon1, lat2, lon2) {
    const x = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
    return Math.hypot(x, lat2 - lat1) * 60;
}
// ARINC 424 approach types (route type of the final approach) as the charts name them.
const TYPES = {
    I: "ILS", L: "LOC", B: "LOC BC", R: "RNAV (GPS)", H: "RNAV (RNP)", P: "GPS", V: "VOR", S: "VOR/DME", D: "VOR/DME", N: "NDB",
    Q: "NDB/DME", X: "LDA", U: "SDF", T: "TACAN",
};
const CIRCLING = {
    RNV: "RNAV (GPS)", VDM: "VOR/DME", VOR: "VOR", NDB: "NDB", GPS: "GPS", LOC: "LOC", LDA: "LDA", LBC: "LOC BC", TCN: "TACAN", SDF: "SDF", ILS: "ILS",
};
/** "I07L" -> "ILS RWY 07L", "R08-Y" -> "RNAV (GPS) Y RWY 08", "VDM-A" -> "VOR/DME-A". */
export function approachName(id) {
    const c = id.match(/^([A-Z]{3})-([A-Z])$/);
    if (c)
        return `${CIRCLING[c[1]] ?? c[1]}-${c[2]}`;
    const r = id.match(/^([A-Z])(\d\d[LRC]?)-?([A-Z]?)$/);
    return r ? `${TYPES[r[1]] ?? r[1]}${r[3] ? ` ${r[3]}` : ""} RWY ${r[2]}` : id;
}
// N33263204 / W112193234: degrees, minutes, seconds in hundredths.
function coord(s) {
    if (!/^[NSEW]\d{8,9}$/.test(s))
        return null;
    const n = s.length - 6; // after the degrees: minutes, then seconds in hundredths
    const v = Number(s.slice(1, n)) + Number(s.slice(n, n + 2)) / 60 + Number(s.slice(n + 2)) / 360000;
    return Math.round((s[0] === "S" || s[0] === "W" ? -v : v) * 1e5) / 1e5;
}
/** Fix positions from the CIFP's waypoint, runway and navaid records. Keys come from cifpFixKey. */
export function cifpPositions(lines) {
    const at = new Map();
    for (const l of lines) {
        if (l[0] !== "S")
            continue;
        const sec = l[4] === "P" ? `P${l[12]}` : l.slice(4, 6);
        let key = null;
        if (sec === "PC" || sec === "PG" || sec === "PN")
            key = `${sec}|${l.slice(6, 10).trim()}|${l.slice(13, 18).trim()}`;
        else if (sec === "EA" || sec === "D " || sec === "DB")
            key = `${sec}|${l.slice(13, 18).trim()}|${l.slice(19, 21)}`;
        if (!key || at.has(key))
            continue;
        const la = coord(l.slice(32, 41));
        const lo = coord(l.slice(41, 51));
        if (la !== null && lo !== null)
            at.set(key, [la, lo]);
    }
    return at;
}
/** The key cifpPositions files a leg's fix under. */
export function cifpFixKey(l, airport, fix) {
    const sec = l.slice(36, 38);
    return sec[0] === "P" ? `${sec}|${airport}|${fix}` : `${sec}|${fix}|${l.slice(34, 36)}`;
}
/** Waypoint description code, 4th character: the fix's role on the way in. */
export const cifpRole = (l) => "ACD".includes(l[42]) ? "IAF" : "BI".includes(l[42]) ? "IF" : l[42] === "F" ? "FAF" : l[42] === "M" ? "MAP" : null;
