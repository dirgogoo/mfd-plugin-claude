/**
 * Timeline page — Git history visualization for MFD model evolution.
 * Canvas view (horizontal timeline with dots) + Cards view (grid of commit cards).
 * Detail modal on click. Toggle between views with V key.
 */
export function renderTimeline(snapshot) {
    return `<div class="timeline-page" id="timeline-page">
  <!-- Header -->
  <div class="timeline-header">
    <div class="timeline-header-left">
      <h2 class="timeline-title">TIMELINE</h2>
      <span class="timeline-summary" id="timeline-summary">Loading git history...</span>
    </div>
    <div class="timeline-header-right">
      <div class="timeline-view-toggle" id="timeline-view-toggle">
        <button class="timeline-toggle-btn active" data-view="canvas" title="Canvas view">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="1" y1="8" x2="15" y2="8"/>
            <circle cx="4" cy="8" r="2" fill="currentColor"/>
            <circle cx="9" cy="8" r="2" fill="currentColor"/>
            <circle cx="14" cy="8" r="1.5" fill="currentColor"/>
          </svg>
        </button>
        <button class="timeline-toggle-btn" data-view="cards" title="Cards view">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="1" width="6" height="6" rx="1"/>
            <rect x="9" y="1" width="6" height="6" rx="1"/>
            <rect x="1" y="9" width="6" height="6" rx="1"/>
            <rect x="9" y="9" width="6" height="6" rx="1"/>
          </svg>
        </button>
      </div>
      <span class="timeline-hint"><kbd>V</kbd> toggle view</span>
    </div>
  </div>

  <!-- Canvas View (default) -->
  <div class="timeline-canvas-view" id="timeline-canvas-view">
    <div class="timeline-canvas-container" id="timeline-canvas-container">
      <div class="timeline-world" id="timeline-world">
        <div class="timeline-line" id="timeline-line"></div>
      </div>
    </div>
  </div>

  <!-- Cards View -->
  <div class="timeline-cards-view" id="timeline-cards-view" style="display:none">
    <div class="timeline-cards-header">
      <span class="timeline-cards-count" id="timeline-cards-count"></span>
      <div class="timeline-card-sort" id="timeline-card-sort">
        <button class="timeline-sort-btn active" data-sort="date">by date</button>
        <button class="timeline-sort-btn" data-sort="changes">by changes</button>
        <button class="timeline-sort-btn" data-sort="impl">by impl</button>
      </div>
    </div>
    <div class="timeline-cards-grid" id="timeline-cards-grid"></div>
  </div>

  <!-- Detail Modal -->
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