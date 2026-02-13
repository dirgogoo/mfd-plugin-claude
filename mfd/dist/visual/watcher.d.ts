/**
 * File watcher with debounce for .mfd files.
 * Emits callback when file changes, debounced to 300ms.
 */
import { type FSWatcher } from "node:fs";
export interface WatcherOptions {
    debounceMs?: number;
}
export declare function createWatcher(filePath: string, onChange: () => void, options?: WatcherOptions): FSWatcher;
//# sourceMappingURL=watcher.d.ts.map