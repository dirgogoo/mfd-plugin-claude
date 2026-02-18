/**
 * Timeline page — Git history visualization for MFD model evolution.
 * SVG canvas with DiagramCanvas zoom/pan. Detail modal on click.
 */
export function renderTimeline(snapshot) {
    return `<div class="timeline-page" id="timeline-page">
  <div class="timeline-header">
    <div class="timeline-header-left">
      <h2 class="timeline-title">TIMELINE</h2>
      <span class="timeline-summary" id="timeline-summary">Loading git history...</span>
    </div>
  </div>
  <div class="timeline-canvas-view" id="timeline-canvas-view">
    <div class="timeline-canvas-container" id="timeline-canvas-container">
      <!-- SVG injected by JS -->
    </div>
  </div>
  <div class="timeline-modal-overlay" id="timeline-detail-modal" style="display:none">
    <div class="timeline-modal">
      <div class="timeline-modal-header" id="timeline-modal-header"></div>
      <div class="timeline-modal-message" id="timeline-modal-message"></div>
      <div class="timeline-modal-stats" id="timeline-modal-stats"></div>
      <div class="timeline-modal-events" id="timeline-modal-events"></div>
      <button class="timeline-modal-close" id="timeline-modal-close" title="Close (Esc)">&times;</button>
    </div>
  </div>
</div>`;
}
//# sourceMappingURL=timeline.js.map