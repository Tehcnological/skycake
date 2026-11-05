// A scene: everything the view shows at one moment. Free roam starts from one; walkthrough steps and quiz questions
// each set one. resolve() fills in the defaults and checks every name against the area's data.
import { KINDS } from "./airspace.js";
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
    const procedures = (scene.procedures ?? []).map(({ airport, name }) => {
        if (!data.airports.find((a) => a.id === airport)?.procedures.some((p) => p.name === name))
            throw new SceneError(`no procedure ${name} at ${airport}`);
        return { airport, name };
    });
    const diagram = scene.diagram ?? null;
    if (diagram !== null && !data.airports.find((a) => a.id === diagram)?.diagram)
        throw new SceneError(`no diagram for ${diagram}`);
    const camera = scene.camera;
    if (camera && typeof camera === "object" && "frame" in camera)
        for (const t of camera.frame)
            target(t, data);
    return { camera: scene.camera === undefined ? "fit" : scene.camera, raised, procedures, diagram, height: scene.height ?? 4, tags: scene.tags ?? true };
}
function target(t, data) {
    if ("area" in t && !data.areas.some((a) => a.id === t.area))
        throw new SceneError(`no area ${t.area}`);
    if ("procedure" in t) {
        const { airport, name } = t.procedure;
        if (!data.airports.find((a) => a.id === airport)?.procedures.some((p) => p.name === name))
            throw new SceneError(`no procedure ${name} at ${airport}`);
    }
    if ("diagram" in t && !data.airports.find((a) => a.id === t.diagram)?.diagram)
        throw new SceneError(`no diagram for ${t.diagram}`);
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
