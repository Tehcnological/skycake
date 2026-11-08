// A scene: everything the view shows at one moment. Free roam starts from one; walkthrough steps and quiz questions
// each set one. resolve() fills in the defaults and checks every name against the area's data.
import { KINDS, pickChart } from "./airspace.js";
export class SceneError extends Error {
}
export function resolve(scene, data) {
    const raised = new Set();
    for (const r of scene.raise ?? []) {
        if (typeof r === "string") {
            for (const a of data.areas)
                if (a.kind === r)
                    raised.add(a.id);
        }
        else {
            if (!data.areas.some((a) => a.id === r.area))
                throw new SceneError(`no area ${r.area}`);
            raised.add(r.area);
        }
    }
    const procedures = (scene.procedures ?? []).map(({ airport, name, draw }) => {
        procedureOf({ airport, name }, data);
        return { airport, name, draw: draw ?? false };
    });
    const highlight = scene.highlight ?? [];
    for (const t of highlight)
        target(t, data);
    const airplane = scene.airplane ?? null;
    if (airplane && "along" in airplane)
        procedureOf(airplane.along, data);
    if (airplane && "at" in airplane) {
        const [lat, lon] = airplane.at;
        const b = data.bounds;
        if (lat < b.s || lat > b.n || lon < b.w || lon > b.e)
            throw new SceneError(`airplane at ${lat}, ${lon} is outside the area`);
    }
    const diagram = scene.diagram ?? null;
    if (diagram !== null && !data.airports.find((a) => a.id === diagram)?.diagram)
        throw new SceneError(`no diagram for ${diagram}`);
    const camera = scene.camera;
    if (camera && typeof camera === "object" && "frame" in camera)
        for (const t of camera.frame)
            target(t, data);
    return { camera: scene.camera === undefined ? "fit" : scene.camera, raised, procedures, highlight, airplane, diagram, height: scene.height ?? 1, tags: scene.tags ?? true, chart: pickChart(data.charts, scene.chart) };
}
function procedureOf({ airport, name }, data) {
    if (!data.airports.find((a) => a.id === airport)?.procedures.some((p) => p.name === name))
        throw new SceneError(`no procedure ${name} at ${airport}`);
}
function target(t, data) {
    if ("area" in t && !data.areas.some((a) => a.id === t.area))
        throw new SceneError(`no area ${t.area}`);
    if ("airport" in t && !data.airports.some((a) => a.id === t.airport))
        throw new SceneError(`no airport ${t.airport}`);
    if ("procedure" in t)
        procedureOf(t.procedure, data);
    if ("diagram" in t && !data.airports.find((a) => a.id === t.diagram)?.diagram)
        throw new SceneError(`no diagram for ${t.diagram}`);
}
/** The scene without playback (highlight, airplane, draw): free roam gets a still scene. */
export function stripPlayback(scene) {
    const { highlight, airplane, ...rest } = scene;
    return scene.procedures ? { ...rest, procedures: scene.procedures.map(({ airport, name }) => ({ airport, name })) } : rest;
}
/** Procedures the camera frames that the scene does not show: their files load for framing only. */
/** Every procedure a scene loads: drawn, framed only, and the one the airplane flies. */
export const sceneRefs = (scene) => [...(scene.procedures ?? []), ...framedOnly(scene), ...(scene.airplane && "along" in scene.airplane ? [scene.airplane.along] : [])];
export function framedOnly(scene) {
    const cam = scene.camera;
    if (!cam || typeof cam !== "object" || !("frame" in cam))
        return [];
    const shown = scene.procedures ?? [];
    const out = [];
    for (const t of cam.frame) {
        if (!("procedure" in t))
            continue;
        const { airport, name } = t.procedure;
        if (![...shown, ...out].some((p) => p.airport === airport && p.name === name))
            out.push({ airport, name });
    }
    return out;
}
/**
 * The scene without each field that names something the data lacks, so the rest still shows; warn() says what was
 * left out. hasFix: whether a fix name is known (fixes live in the procedure files, which resolve() does not read).
 */
export function usable(scene, data, hasFix, warn) {
    const out = { ...scene };
    for (const k of Object.keys(scene)) {
        try {
            resolve({ [k]: scene[k] }, data);
            const cam = scene.camera;
            const targets = k === "highlight" ? (scene.highlight ?? []) : k === "camera" && cam && typeof cam === "object" && "frame" in cam ? cam.frame : [];
            for (const t of targets)
                if ("fix" in t && !hasFix(t.fix))
                    throw new SceneError(`no fix ${t.fix}`);
        }
        catch (e) {
            if (!(e instanceof SceneError))
                throw e;
            warn(`${e.message}; leaving out the scene's ${k}`);
            delete out[k];
        }
    }
    return out;
}
/** Free roam's first view: every airspace type in the area raised, the whole chart in view. */
export function freeRoamScene(data) {
    return { camera: "fit", raise: KINDS.filter((k) => data.areas.some((a) => a.kind === k)) };
}
/** mount()'s older options as a first scene; undefined when none is given. */
export function shorthand(o, data) {
    if (!o.types && !o.airport && !o.approach)
        return undefined;
    const scene = { camera: "fit", raise: o.types ?? freeRoamScene(data).raise };
    const airport = o.airport ?? "KPHX";
    if (o.approach) {
        scene.procedures = [{ airport, name: o.approach }];
        scene.camera = { frame: [{ procedure: { airport, name: o.approach } }] };
    }
    return scene;
}
/**
 * The first scene from mount()'s options. A name the data no longer has (an FAA cycle renamed an approach, a typo)
 * falls back to free roam's first view, and warn() says why, so the embed still works.
 */
export function firstScene(o, data, warn) {
    const scene = o.scene ?? shorthand(o, data) ?? freeRoamScene(data);
    try {
        resolve(scene, data);
        return scene;
    }
    catch (e) {
        if (!(e instanceof SceneError))
            throw e;
        warn(`skycake: ${e.message}; showing the whole chart instead`);
        return freeRoamScene(data);
    }
}
