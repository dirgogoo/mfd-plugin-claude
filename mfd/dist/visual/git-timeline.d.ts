/**
 * Git Timeline — extracts MFD model history from git commits.
 * Analyzes diffs to detect construct additions/removals and @impl changes.
 */
export interface TimelineSubEvent {
    type: 'construct_added' | 'construct_removed' | 'construct_modified' | 'impl_added' | 'impl_removed' | 'impl_changed';
    constructType: string;
    constructName: string;
    detail?: string;
}
export interface TimelineCommit {
    hash: string;
    shortHash: string;
    date: string;
    author: string;
    message: string;
    subEvents: TimelineSubEvent[];
    stats: {
        added: number;
        removed: number;
        modified: number;
        implAdded: number;
        implRemoved: number;
    };
}
export interface TimelineData {
    commits: TimelineCommit[];
    mfdFiles: string[];
    generatedAt: number;
}
export declare function invalidateTimelineCache(): void;
export declare function getOrLoadTimeline(filePath: string, limit?: number): Promise<TimelineData>;
export declare function loadGitTimeline(filePath: string, limit?: number): Promise<TimelineData>;
//# sourceMappingURL=git-timeline.d.ts.map