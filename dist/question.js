import { nm } from "./cifp.js";
/** Locate from the area: a fix in the loaded procedures or the area's waypoints, an airport, a point. */
export const locator = (data, procedures) => (t) => {
    if ("point" in t)
        return t.point;
    const p = "airport" in t ? data.airports.find((a) => a.id === t.airport) : "fix" in t ? (procedures.flatMap((x) => x.fixes).find((f) => f.name === t.fix) ?? data.waypoints.find((w) => w.name === t.fix)) : undefined;
    return p ? [p.lat, p.lon] : null;
};
const FIND_NM = 1.5;
export function score(q, a, locate) {
    if ("choices" in q)
        return "choice" in a && a.choice === q.answer;
    if ("number" in q)
        return "number" in a && Math.abs(a.number - q.number.answer) <= q.number.tolerance;
    if (!("area" in a))
        return false;
    if ("area" in q.answer)
        return a.area === q.answer.area;
    const p = locate(q.answer);
    return !!(p && a.at && nm(p[0], p[1], a.at[0], a.at[1]) <= FIND_NM);
}
const around = (lat, lon) => {
    const dLat = 5 / 60;
    const dLon = dLat / Math.cos((lat * Math.PI) / 180);
    return [[lat + dLat, lon], [lat - dLat, lon], [lat, lon + dLon], [lat, lon - dLon]].map((point) => ({ point: point }));
};
function defaults(q) {
    const flat = { raise: [], tags: false };
    const top = { camera: "top", ...flat };
    if (q.type === "find")
        return top;
    if (q.type === "procedure")
        return q.scene?.procedures?.length ? { camera: { frame: q.scene.procedures.map((procedure) => ({ procedure: { airport: procedure.airport, name: procedure.name } })) } } : {};
    const plane = q.scene?.airplane;
    if (plane && "at" in plane)
        return { camera: { frame: around(plane.at[0], plane.at[1]), tilt: 90 }, ...flat };
    if (q.type === "read" && q.scene?.highlight?.length)
        return { camera: { frame: q.scene.highlight, tilt: 90 }, ...flat };
    return top;
}
/** The type's default scene with the question's own fields laid over it. */
export const questionScene = (q) => ({ ...defaults(q), ...q.scene });
/** After the answer: the answer raised, tags on, tilted to 3D on the frame the question showed. */
export function revealScene(q) {
    const s = questionScene(q);
    const areas = (ts) => ts.filter((t) => "area" in t);
    const answer = q.type === "find" ? [q.answer] : [];
    const raise = areas([...answer, ...(q.scene?.highlight ?? []), ...(q.answerArea ? [{ area: q.answerArea }] : [])]);
    const frame = s.camera && typeof s.camera === "object" && "frame" in s.camera ? s.camera.frame : [...answer, ...(q.scene?.highlight ?? [])];
    return { ...s, raise, tags: true, camera: frame.length ? { frame, tilt: 32 } : s.camera };
}
