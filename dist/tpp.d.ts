/**
 * The FAA's procedure charts (d-TPP) of an airport: its records in the cycle's metafile, grouped into charts with their
 * continuation pages, and matched to the procedures skycake builds from the CIFP. Pure; scripts/build-area.ts does the I/O.
 */
/** A chart in data/<area>/charts/<airport>.json: its pages (file names, first page first) and the procedures it draws. */
export type ChartEntry = {
    name: string;
    kind: "IAP" | "DP" | "STR";
    pages: string[];
    procedures: string[];
};
/** One <record> of the metafile. */
export type ChartRecord = {
    code: string;
    name: string;
    pdf: string;
    action: string;
};
/** The airport's block of the metafile, by its ICAO or FAA identifier. */
export declare const airportBlock: (meta: string, id: string) => string | undefined;
/** Every record of an airport's block, in metafile order. */
export declare const chartRecords: (block: string) => ChartRecord[];
/** Approaches, departures and arrivals (deleted records left out), each with its continuation pages after the first. */
export declare function chartGroups(recs: ChartRecord[]): {
    kind: ChartEntry["kind"];
    name: string;
    pdfs: string[];
}[];
/** A page's image file: "00322IL7R.PDF" to "00322il7r.png". */
export declare const pageFile: (pdf: string) => string;
/** Whether an approach chart's name ("ILS OR LOC/DME RWY 07L") draws a skycake procedure ("LOC RWY 07L"). */
export declare function approachMatches(chart: string, procedure: string): boolean;
/** Both names of every computer code, "(BXK4.BXK)", in a chart's text. */
export declare const codesIn: (text: string) => string[];
/** The airport's procedures a chart draws: approaches by type and runway, departures and arrivals by the computer code on the first page. */
export declare function proceduresOn(kind: ChartEntry["kind"], name: string, firstPageText: string, procedures: {
    type: "IAP" | "SID" | "STAR";
    name: string;
}[]): string[];
/** Procedures no chart draws. */
export declare const noChart: (entries: ChartEntry[], procedures: {
    name: string;
}[]) => string[];
