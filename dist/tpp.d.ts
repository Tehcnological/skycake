export type ChartEntry = {
    name: string;
    kind: "IAP" | "DP" | "STR";
    pages: string[];
    procedures: string[];
};
