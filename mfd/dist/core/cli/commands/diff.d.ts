export interface DiffEntry {
    type: "added" | "removed" | "modified";
    kind: string;
    name: string;
    details?: string;
}
export declare function diffCommand(file1: string, file2: string): void;
//# sourceMappingURL=diff.d.ts.map