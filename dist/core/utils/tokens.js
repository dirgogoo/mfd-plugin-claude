/**
 * Rough token estimation for MFD-DSL text.
 * Uses a simple heuristic: ~4 characters per token (similar to cl100k_base).
 */
export function estimateTokens(text) {
    // Remove comment-only lines and empty lines for a cleaner estimate
    const lines = text.split("\n");
    let charCount = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0)
            continue;
        charCount += trimmed.length + 1; // +1 for newline
    }
    // ~4 chars per token is a reasonable approximation for code-like text
    return Math.ceil(charCount / 4);
}
//# sourceMappingURL=tokens.js.map