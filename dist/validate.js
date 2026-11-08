import { usable } from "./scene.js";
/** Problems with a scene, one per field that names something the data lacks. */
function sceneProblems(scene, data, hasFix) {
    const out = [];
    usable(scene ?? {}, data, hasFix, (m) => out.push(m.replace(/; leaving out .*$/, "")));
    return out;
}
/** Problems with a question, without a prefix; the quiz validator reuses this. */
export function questionProblems(q, data, hasFix) {
    const out = sceneProblems(q.scene, data, hasFix);
    if (q.type === "find")
        out.push(...sceneProblems({ highlight: [q.answer] }, data, hasFix));
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
/** Whether a fix name is in any airport's procedures or the area's waypoints. */
export async function fixFinder(data, procedures) {
    const names = new Set(data.waypoints.map((w) => w.name));
    for (const a of data.airports)
        for (const p of await procedures(a.id))
            for (const f of p.fixes)
                names.add(f.name);
    return (name) => names.has(name);
}
/** area: the folder name the site loaded (the data carries no area name). Problems read "<id> step <n>: <problem>". */
export async function validateWalkthrough(w, data, procedures, area) {
    const out = [];
    if (w.area !== area)
        out.push(`${w.id}: area ${w.area}, data is ${area}`);
    const hasFix = await fixFinder(data, procedures);
    w.steps.forEach((s, i) => {
        const at = `${w.id} step ${i + 1}: `;
        const problems = [];
        if (typeof s.caption !== "string")
            problems.push("caption is not text");
        if (s.seconds !== undefined && !(s.seconds > 0))
            problems.push("seconds must be above 0");
        problems.push(...sceneProblems(s.scene, data, hasFix), ...(s.check ? questionProblems(s.check, data, hasFix) : []));
        out.push(...problems.map((p) => at + p));
    });
    return out;
}
