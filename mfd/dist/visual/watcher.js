/**
 * File watcher with debounce for .mfd files.
 * Emits callback when file changes, debounced to 300ms.
 */
import { watch } from "node:fs";
import { dirname } from "node:path";
export function createWatcher(filePath, onChange, options = {}) {
    const debounceMs = options.debounceMs ?? 300;
    let timer = null;
    const watcher = watch(dirname(filePath), (eventType, filename) => {
        // Only react to changes in the target file
        if (!filename || !filePath.endsWith(filename))
            return;
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            onChange();
        }, debounceMs);
    });
    return watcher;
}
//# sourceMappingURL=watcher.js.map