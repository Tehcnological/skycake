// Demo only: the real viewer, with the view it builds put on window.v for trying things in the console. index.html's
// import map sends dist/ui.js's import of the viewer here, and this file's own import to the real one.
import { build as real } from "/dist/viewer.js";
export * from "/dist/viewer.js";
export const build = async (...args) => (window.v = await real(...args));
