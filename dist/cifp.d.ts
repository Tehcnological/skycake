/** Distance in NM, flat-earth: fine across one chart. */
export declare function nm(lat1: number, lon1: number, lat2: number, lon2: number): number;
/** "I07L" -> "ILS RWY 07L", "R08-Y" -> "RNAV (GPS) Y RWY 08", "VDM-A" -> "VOR/DME-A". */
export declare function approachName(id: string): string;
/** Fix positions from the CIFP's waypoint, runway and navaid records. Keys come from cifpFixKey. */
export declare function cifpPositions(lines: string[]): Map<string, [number, number]>;
/** The key cifpPositions files a leg's fix under. */
export declare function cifpFixKey(l: string, airport: string, fix: string): string;
/** Waypoint description code, 4th character: the fix's role on the way in. */
export declare const cifpRole: (l: string) => "IAF" | "IF" | "FAF" | "MAP" | null;
