/**
 * Git Timeline — extracts MFD model history from git commits.
 * Analyzes diffs to detect construct additions/removals and @impl changes.
 */
import { simpleGit } from "simple-git";
import { dirname } from "node:path";
// ===== Cache =====
let cachedTimeline = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds
export function invalidateTimelineCache() {
    cachedTimeline = null;
    cacheTimestamp = 0;
}
export async function getOrLoadTimeline(filePath, limit = 100) {
    const now = Date.now();
    if (cachedTimeline && (now - cacheTimestamp) < CACHE_TTL) {
        return cachedTimeline;
    }
    cachedTimeline = await loadGitTimeline(filePath, limit);
    cacheTimestamp = now;
    return cachedTimeline;
}
// ===== Construct patterns =====
const CONSTRUCT_KEYWORDS = [
    'entity', 'flow', 'screen', 'state', 'event', 'signal', 'enum',
    'rule', 'api', 'journey', 'operation', 'action', 'element',
    'component', 'dep', 'secret',
];
const CONSTRUCT_RE = new RegExp(`^\\s*(${CONSTRUCT_KEYWORDS.join('|')})\\s+(\\w+)`);
const IMPL_RE = /@impl\(([^)]+)\)/;
// ===== Main loader =====
export async function loadGitTimeline(filePath, limit = 100) {
    const dir = dirname(filePath);
    let git;
    let repoRoot;
    try {
        git = simpleGit(dir);
        // Find repo root so globs work from top-level
        repoRoot = (await git.revparse(['--show-toplevel'])).trim();
        git = simpleGit(repoRoot);
    }
    catch {
        // Not a git repo — graceful degradation
        return { commits: [], mfdFiles: [], generatedAt: Date.now() };
    }
    // Get commits that touch .mfd files (from repo root, *.mfd matches all)
    let logResult;
    try {
        logResult = await git.log({
            maxCount: limit,
            file: '*.mfd',
        });
    }
    catch {
        // git log failed (empty repo, no .mfd files, etc.)
        return { commits: [], mfdFiles: [], generatedAt: Date.now() };
    }
    if (!logResult.all.length) {
        return { commits: [], mfdFiles: [], generatedAt: Date.now() };
    }
    // Collect unique mfd files
    const mfdFiles = new Set();
    // Process each commit
    const commits = [];
    for (const entry of logResult.all) {
        const subEvents = [];
        try {
            // Get diff for this commit (against parent)
            const diffText = await git.diff([`${entry.hash}~1`, entry.hash, '--', '*.mfd']);
            parseDiff(diffText, subEvents, mfdFiles);
        }
        catch {
            // First commit or diff error — try showing the commit as-is
            try {
                const diffText = await git.show([entry.hash, '--format=', '--', '*.mfd']);
                parseDiff(diffText, subEvents, mfdFiles);
            }
            catch {
                // Skip this commit
            }
        }
        const stats = {
            added: 0,
            removed: 0,
            modified: 0,
            implAdded: 0,
            implRemoved: 0,
        };
        for (const ev of subEvents) {
            switch (ev.type) {
                case 'construct_added':
                    stats.added++;
                    break;
                case 'construct_removed':
                    stats.removed++;
                    break;
                case 'construct_modified':
                    stats.modified++;
                    break;
                case 'impl_added':
                    stats.implAdded++;
                    break;
                case 'impl_removed':
                    stats.implRemoved++;
                    break;
                case 'impl_changed':
                    stats.implAdded++;
                    stats.implRemoved++;
                    break;
            }
        }
        commits.push({
            hash: entry.hash,
            shortHash: entry.hash.slice(0, 7),
            date: entry.date,
            author: entry.author_name,
            message: entry.message,
            subEvents,
            stats,
        });
    }
    return {
        commits,
        mfdFiles: [...mfdFiles],
        generatedAt: Date.now(),
    };
}
// ===== Diff parser =====
function parseDiff(diffText, subEvents, mfdFiles) {
    const lines = diffText.split('\n');
    // Track constructs seen in + and - lines to detect modifications
    const addedConstructs = new Map(); // key → constructType
    const removedConstructs = new Map();
    const addedImpls = new Map(); // "type:name" → impl value
    const removedImpls = new Map();
    for (const line of lines) {
        // Track file names
        if (line.startsWith('+++ b/') || line.startsWith('--- a/')) {
            const fpath = line.slice(6);
            if (fpath.endsWith('.mfd'))
                mfdFiles.add(fpath);
            continue;
        }
        // Only process actual diff lines (not headers)
        if (!line.startsWith('+') && !line.startsWith('-'))
            continue;
        if (line.startsWith('+++') || line.startsWith('---'))
            continue;
        const isAdd = line.startsWith('+');
        const content = line.slice(1); // Remove the +/- prefix
        // Check for construct declarations
        const constructMatch = content.match(CONSTRUCT_RE);
        if (constructMatch) {
            const [, cType, cName] = constructMatch;
            const key = `${cType}:${cName}`;
            if (isAdd) {
                addedConstructs.set(key, cType);
            }
            else {
                removedConstructs.set(key, cType);
            }
        }
        // Check for @impl
        const implMatch = content.match(IMPL_RE);
        if (implMatch) {
            const implValue = implMatch[1];
            // Try to find construct context from the same line
            const ctxMatch = content.match(CONSTRUCT_RE);
            if (ctxMatch) {
                const key = `${ctxMatch[1]}:${ctxMatch[2]}`;
                if (isAdd) {
                    addedImpls.set(key, implValue);
                }
                else {
                    removedImpls.set(key, implValue);
                }
            }
        }
    }
    // Classify construct changes
    for (const [key, cType] of addedConstructs) {
        const name = key.split(':')[1];
        if (removedConstructs.has(key)) {
            // Present in both + and - → modified
            subEvents.push({ type: 'construct_modified', constructType: cType, constructName: name });
            removedConstructs.delete(key);
        }
        else {
            subEvents.push({ type: 'construct_added', constructType: cType, constructName: name });
        }
    }
    for (const [key, cType] of removedConstructs) {
        const name = key.split(':')[1];
        subEvents.push({ type: 'construct_removed', constructType: cType, constructName: name });
    }
    // Classify @impl changes
    for (const [key, implValue] of addedImpls) {
        const [cType, cName] = key.split(':');
        if (removedImpls.has(key)) {
            const oldValue = removedImpls.get(key);
            subEvents.push({
                type: 'impl_changed',
                constructType: cType,
                constructName: cName,
                detail: `@impl(${oldValue}) → @impl(${implValue})`,
            });
            removedImpls.delete(key);
        }
        else {
            subEvents.push({
                type: 'impl_added',
                constructType: cType,
                constructName: cName,
                detail: `@impl(${implValue})`,
            });
        }
    }
    for (const [key, implValue] of removedImpls) {
        const [cType, cName] = key.split(':');
        subEvents.push({
            type: 'impl_removed',
            constructType: cType,
            constructName: cName,
            detail: `@impl(${implValue})`,
        });
    }
}
//# sourceMappingURL=git-timeline.js.map