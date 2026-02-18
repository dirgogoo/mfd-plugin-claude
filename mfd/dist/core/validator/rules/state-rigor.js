import { collectModel } from "../collect.js";
/**
 * State machine rigor rules:
 *
 * STATE_UNREACHABLE: A state that no transition leads to (and is not the initial state).
 *   The first enum value is considered the initial state.
 *   Wildcard `*` as from expands to all states.
 *   Skip: enums with < 2 values.
 *
 * STATE_DEAD_END: A non-terminal state with no outgoing transition.
 *   Terminal names (case-insensitive): cancelado, cancelled, archived, arquivado,
 *   deleted, completed, finalizado, done, closed, fechado, rejected, rejeitado,
 *   expired, expirado.
 */
const TERMINAL_NAMES = new Set([
    "cancelado", "cancelled", "archived", "arquivado",
    "deleted", "completed", "finalizado", "done",
    "closed", "fechado", "rejected", "rejeitado",
    "expired", "expirado",
]);
export function stateRigor(doc) {
    const model = collectModel(doc);
    const diagnostics = [];
    // Build enum lookup
    const enumMap = new Map();
    for (const e of model.enums) {
        enumMap.set(e.name, e.values.map((v) => v.name));
    }
    for (const state of model.states) {
        const enumValues = enumMap.get(state.enumRef);
        if (!enumValues || enumValues.length < 2)
            continue;
        const allStates = new Set(enumValues);
        const initialState = enumValues[0];
        // Build reachable targets and sources
        const reachableTargets = new Set();
        const sources = new Set();
        for (const tr of state.transitions) {
            // Expand wildcard for targets
            reachableTargets.add(tr.to);
            // Expand wildcard for sources
            if (tr.from === "*") {
                for (const s of allStates) {
                    sources.add(s);
                }
            }
            else {
                sources.add(tr.from);
            }
            // Wildcard from means all states lead somewhere, so all are reachable targets indirectly
            if (tr.from === "*") {
                // * -> X means "from any state", which implies all states are sources
                // but does NOT make all states reachable as targets
            }
        }
        // STATE_UNREACHABLE: not initial, not a target of any transition
        // Also account for wildcard: if any transition has `* -> X`, then the `*` from
        // doesn't make states reachable — only the `to` side matters for reachability
        for (const s of allStates) {
            if (s === initialState)
                continue;
            if (reachableTargets.has(s))
                continue;
            diagnostics.push({
                code: "STATE_UNREACHABLE",
                severity: "warning",
                message: `State '${s}' in machine '${state.name}' is unreachable — no transition leads to it`,
                location: state.loc,
                help: `Add a transition leading to '${s}' or remove it from the enum`,
            });
        }
        // STATE_DEAD_END: not a source and not terminal
        for (const s of allStates) {
            if (sources.has(s))
                continue;
            if (TERMINAL_NAMES.has(s.toLowerCase()))
                continue;
            diagnostics.push({
                code: "STATE_DEAD_END",
                severity: "warning",
                message: `State '${s}' in machine '${state.name}' has no outgoing transition (dead end)`,
                location: state.loc,
                help: `Add a transition from '${s}' or rename it to a terminal name (e.g., cancelled, completed, archived)`,
            });
        }
    }
    return diagnostics;
}
//# sourceMappingURL=state-rigor.js.map