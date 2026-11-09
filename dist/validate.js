import { maker } from "./quiz.js";
import { seeded } from "./generate.js";
import { LABELS } from "./ui.js";
import { locator, questionScene } from "./question.js";
import { resolve, sceneRefs, usable } from "./scene.js";
/** Problems with a scene, one per field that names something the data lacks. */
function sceneProblems(scene, data, hasFix) {
    const out = [];
    usable(scene ?? {}, data, hasFix, (m) => out.push(m.replace(/; leaving out .*$/, "")));
    return out;
}
/** Problems with a scene's plate against the airport's chart index. Skipped with no loader, or when sceneProblems already reports the plate. */
async function plateProblems(scene, data, charts) {
    const plate = scene?.plate;
    if (!plate || !charts)
        return [];
    try {
        resolve({ plate }, data);
    }
    catch {
        return [];
    }
    let index;
    try {
        index = await charts(plate.airport);
    }
    catch {
        return [`no charts for ${plate.airport}`];
    }
    const chart = index.find((c) => c.name === plate.chart);
    if (!chart)
        return [`no chart ${plate.chart} at ${plate.airport}; charts there: ${index.map((c) => c.name).join(", ")}`];
    const n = chart.pages.length;
    return plate.page !== undefined && plate.page > n ? [`chart ${chart.name} has ${n} page${n === 1 ? "" : "s"}, not ${plate.page}`] : [];
}
/** Whether a fix name is known where the browser looks for a scene's fixes: the procedures it loads, then the area's waypoints. */
function fixesIn(data, loaded, scene) {
    const refs = sceneRefs(scene);
    const locate = locator(data, loaded.filter((p) => refs.some((r) => r.airport === p.airport && r.name === p.name)));
    return (name) => !!locate({ fix: name });
}
/** Problems with a find question's answer: what the browser can tap and locate. loaded: every procedure of the area. */
function answerProblems(q, data, hasFix, loaded) {
    const t = q.answer;
    if (!t || typeof t !== "object" || !["area", "fix", "airport", "point"].some((k) => k in t))
        return ["answer must be an area, fix, airport or point"];
    const out = sceneProblems({ highlight: [q.answer] }, data, hasFix);
    if (out.length)
        return out;
    const area = "area" in q.answer ? q.answer.area : null;
    const also = q.also;
    if (also !== undefined && (!Array.isArray(also) || !area))
        return ["also must be a list of area ids, beside an area answer"];
    const more = also ?? [];
    out.push(...sceneProblems({ highlight: more.map((id) => ({ area: id })) }, data, hasFix));
    const right = [area, ...more];
    for (const id of right) {
        const kind = data.areas.find((a) => a.id === id)?.kind;
        if (kind === "E700" || kind === "MODEC")
            out.push(`area ${id} is ${kind}, which cannot be tapped`);
    }
    if ("fix" in q.answer && !fixesIn(data, loaded, questionScene(q))(q.answer.fix))
        out.push(`fix ${q.answer.fix} is not on the question's procedures or the area's waypoints`);
    return out;
}
/** Problems with a question, without a prefix; the quiz validator reuses this. loaded: every procedure of the area. */
export function questionProblems(q, data, hasFix, loaded) {
    const out = sceneProblems(q.scene, data, fixesIn(data, loaded, questionScene(q)));
    if (q.type === "find")
        out.push(...answerProblems(q, data, hasFix, loaded));
    else if (!("choices" in q) && !("number" in q))
        out.push("no choices or number");
    if (q.answerArea !== undefined)
        out.push(...sceneProblems({ highlight: [{ area: q.answerArea }] }, data, hasFix));
    if (typeof q.prompt !== "string" || !q.prompt.trim())
        out.push("prompt is empty");
    if ("choices" in q) {
        if (!Array.isArray(q.choices) || q.choices.length < 2 || q.choices.length > 4)
            out.push("choices must be 2 to 4");
        else {
            if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length)
                out.push(`answer ${q.answer} is not a choice`);
            if (new Set(q.choices).size < q.choices.length)
                out.push("choices repeat");
        }
    }
    if ("number" in q && !(q.number.tolerance >= 0))
        out.push("tolerance is below 0");
    return out;
}
/** Every procedure of the area's airports, and whether a fix name is in any of them or the area's waypoints. */
async function load(data, procedures) {
    const loaded = (await Promise.all(data.airports.map((a) => procedures(a.id)))).flat();
    const names = new Set([...data.waypoints.map((w) => w.name), ...loaded.flatMap((p) => p.fixes.map((f) => f.name))]);
    return { loaded, hasFix: (name) => names.has(name) };
}
/**
 * area: the folder name the site loaded (the data carries no area name). Problems read "<id> step <n>: <problem>".
 * charts: an airport's charts/<airport>.json; without it plates are not checked.
 */
export async function validateWalkthrough(w, data, procedures, area, charts) {
    const out = [];
    if (w.area !== area)
        out.push(`${w.id}: area ${w.area}, data is ${area}`);
    const { loaded, hasFix } = await load(data, procedures);
    if (!Array.isArray(w.steps) || !w.steps.length)
        out.push(`${w.id}: no steps`);
    else
        for (const [i, s] of w.steps.entries()) {
            const at = `${w.id} step ${i + 1}: `;
            const problems = [];
            if (typeof s.caption !== "string")
                problems.push("caption is not text");
            if (s.seconds !== undefined && !(s.seconds > 0))
                problems.push("seconds must be above 0");
            problems.push(...sceneProblems(s.scene, data, fixesIn(data, loaded, s.scene ?? {})), ...(s.check ? questionProblems(s.check, data, hasFix, loaded) : []));
            problems.push(...(await plateProblems(s.scene, data, charts)), ...(await plateProblems(s.check?.scene, data, charts)));
            out.push(...problems.map((p) => at + p));
        }
    return out;
}
/** Problems read "<quiz id> item <n>: <problem>". A generate item is tried once with seeded(0) and no elevation grid. charts: as validateWalkthrough. */
export async function validateQuiz(q, data, procedures, area, charts) {
    const out = [];
    if (q.area !== area)
        out.push(`${q.id}: area ${q.area}, data is ${area}`);
    const { loaded, hasFix } = await load(data, procedures);
    const make = maker({ data, grid: null, procedures: loaded, ask: LABELS.ask }, seeded(0));
    const ids = new Set();
    for (const [i, it] of q.items.entries()) {
        const problems = [];
        if ("id" in it && it.id !== undefined) {
            if (ids.has(it.id))
                problems.push(`id ${it.id} repeats`);
            ids.add(it.id);
        }
        if (!("generate" in it))
            problems.push(...questionProblems(it, data, hasFix, loaded), ...(await plateProblems(it.scene, data, charts)));
        else {
            if (!(it.count >= 1))
                problems.push("count must be at least 1");
            problems.push(...sceneProblems({ highlight: (it.airports ?? []).map((airport) => ({ airport })) }, data, hasFix));
            if (!problems.length && !make(it))
                problems.push("nothing to ask with these filters");
        }
        out.push(...problems.map((p) => `${q.id} item ${i + 1}: ${p}`));
    }
    return out;
}
