/**
 * Full-page diagram view with floating controls
 */
const LABELS = {
    domain: "Domain Map",
    concept: "Concept Diagram",
    lifecycle: "Lifecycle Machine",
    capability: "Capability Contract",
    objective: "Objective Graph",
    invariant: "Invariant Overview",
    property: "Property Timeline",
};
export function renderDiagramPage(snapshot, type) {
    const mermaidCode = snapshot.diagrams[type];
    const count = getCount(snapshot, type);
    if (count === 0) {
        return `
<div class="scope-fullpage-diagram">
  <div class="scope-diagram-container">
    <div class="scope-empty-state">
      <div class="scope-empty-state-icon">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="24" cy="24" r="20"/><line x1="16" y1="16" x2="32" y2="32"/></svg>
      </div>
      <p>No ${LABELS[type].toLowerCase()} constructs defined</p>
    </div>
  </div>
</div>`;
    }
    return `
<div class="scope-fullpage-diagram">
  <div class="scope-diagram-container" id="diagram-container" data-diagram-type="${type}">
    <div class="mermaid" id="main-diagram" data-type="${type}">${escapeHtml(mermaidCode)}</div>
  </div>
</div>`;
}
function getCount(snapshot, type) {
    switch (type) {
        case "domain": return snapshot.domains.length;
        case "concept": return snapshot.model.concepts.length;
        case "lifecycle": return snapshot.model.concepts.filter(c => c.lifecycle).length;
        case "capability": return snapshot.model.capabilities.length;
        case "objective": return snapshot.model.objectives.length;
        case "invariant": return snapshot.model.invariants.length;
        case "property": return snapshot.model.properties.length;
    }
}
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
//# sourceMappingURL=diagram.js.map