// Built-in interactive tutorial walkthrough for SkyCake Viewer, played over the Phoenix area.
import type { Labels, Walkthrough } from "../src/index.js";

export const TUTORIAL: Walkthrough = {
  id: "tutorial",
  title: "skycake tutorial",
  area: "phoenix",
  steps: [
    {
      caption: "Welcome to SkyCake. This is the real FAA Phoenix Terminal Area Chart draped over terrain. Drag to pan, right-drag or use two fingers to tilt and turn, and scroll or pinch to zoom.",
      seconds: 9,
      scene: { camera: "top", raise: [], chart: "tac" },
    },
    {
      caption: "Raise airspace from the Airspace menu, or tap any shelf on the chart. Height 4× stretches altitudes so thin Class B shelves stand apart from their charted floors to ceilings.",
      seconds: 9,
      scene: { raise: ["B"], height: 4, camera: { azimuth: 20, tilt: 24, distance: 42, target: [33.43, -112] } },
    },
    {
      caption: "Each blue fraction shows ceiling over floor in hundreds of feet. Here is the Phoenix Class B surface core, from the surface up to 9,000 ft MSL.",
      seconds: 8,
      scene: { raise: ["B"], height: 4, highlight: [{ area: "b-phoenix-class-b-sfc-90" }], camera: { frame: [{ area: "b-phoenix-class-b-sfc-90" }], tilt: 28 } },
    },
    {
      caption: "Pick an airport in Search or tap its tag on the chart to toggle its FAA airport diagram right over the runways, at true 1× scale.",
      seconds: 8,
      scene: { raise: ["B"], diagram: "KPHX", height: 1, camera: { frame: [{ diagram: "KPHX" }], tilt: 38 } },
    },
    {
      caption: "Picking an instrument approach switches to the IFR chart and draws its transitions, final course, missed approach, and charted fix altitudes in 3D.",
      seconds: 10,
      scene: {
        raise: ["B"],
        procedures: [{ airport: "KPHX", name: "ILS RWY 07L", draw: true }],
        airplane: { along: { airport: "KPHX", name: "ILS RWY 07L" }, seconds: 10 },
        camera: { frame: [{ procedure: { airport: "KPHX", name: "ILS RWY 07L" } }], tilt: 24 },
      },
    },
    {
      caption: "Open Plate to view the official FAA procedure chart beside the 3D view. Switch between map, plate, and split, drag the divider to resize, and pan or zoom the chart.",
      seconds: 9,
      scene: {
        raise: ["B"],
        procedures: [{ airport: "KPHX", name: "ILS RWY 07L" }],
        camera: { frame: [{ procedure: { airport: "KPHX", name: "ILS RWY 07L" } }], tilt: 24 },
        plate: { airport: "KPHX", chart: "ILS OR LOC/DME RWY 07L" },
      },
    },
    {
      caption: "Try it yourself: tap the Phoenix Class B surface core around Sky Harbor.",
      seconds: 5,
      scene: { raise: ["B"], height: 4, camera: "fit", plate: null },
      check: { type: "find", prompt: "Tap the Phoenix Class B surface core on the chart.", answer: { area: "b-phoenix-class-b-sfc-90" } },
    },
    {
      caption: "You are ready to roam. Select explore to use the map freely, or close to pick another area. SkyCake is for learning, not for navigation.",
      seconds: 7,
      scene: { raise: ["B", "C", "D"], height: 1, camera: "fit", plate: null },
    },
  ],
};

export const TUTORIAL_LABELS: Partial<Labels> = {
  right: "Correct",
  wrong: "Not quite",
  tryAgain: "Not quite. Try once more.",
  rightSecondTry: "Correct on the second try",
  submit: "check",
  continue: "continue",
  answerWas: (answer) => `Answer: ${answer}`,
  play: "play",
  pause: "pause",
  back: "previous step",
  next: "next step",
  explore: "explore",
  stepOf: (n, total) => `${n}/${total}`,
  skip: "skip",
  number: "number",
};
