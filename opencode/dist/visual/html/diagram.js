/**
 * Full-page diagram view with floating controls
 */
const LABELS = {
    component: "Component Map",
    entity: "Entity Diagram",
    state: "State Machine",
    flow: "Flow Diagram",
    screen: "Screen Map",
    journey: "User Journey",
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
        case "component": return snapshot.model.components.length;
        case "entity": return snapshot.model.entities.length;
        case "state": return snapshot.model.states.length;
        case "flow": return snapshot.model.flows.length;
        case "screen": return snapshot.model.screens.length;
        case "journey": return snapshot.model.journeys.length;
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