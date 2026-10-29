# Private meeting context

This extends the existing owner-only analytics route and lazy entry chunk. It uses existing SIMPL typography, label colours, Radix tooltip/popover/dialog patterns and responsive styles. No meeting source data is bundled.

The six primary filters use actual existing label IDs: SPARK/Coke, ROVER/Mars, Compass/Samsung, OBI, Nespresso and SIMPL. GM/SM stay supplementary Coke tags. Cards without these labels remain in unfiltered totals. The old internal `state.project` key is retained for report-state compatibility but stores a label ID, never a column/project name. Project columns remain original task metadata only.

`meetings/chart-bridge.js` supplies separate event slots and date domains for each chart. Events never enter metric series, scales, correlation calculations or moving averages. Temporal charts align real original dates; categorical or non-computable ranges use a companion timeline. The overview also retains dates outside a calculable rolling window. Unknown dates are listed without an invented point. Meetings sharing a day/KW or overlapping at available pixel width retain every identity in a grouped picker.

The catalogue is compact and paginated. Details and each selected-label Markdown protocol load separately on demand, through verified-session owner APIs. Markdown skips raw HTML; custom renderers suppress unsafe/local links and remote images, and resolve available source notes by meeting identity. No original Markdown is parsed to infer presentation or chronology in the browser.

Opening a dialog suspends meeting tooltips/group popovers. Browser-history navigation and breadcrumbs preserve the underlying task filters, interval, overlays, moving-average tick settings and scroll. Changing accounts unmounts private portals and aborts requests. JF is a separate category and never receives inferred project labels. Combining JF with a specific label shows a clear empty state while task metrics remain selected.

Verification: 363 frontend tests and production TypeScript/Vite build; controlled browser tests at 1500/1100/820/390 pixels cover lazy reads, filtered mixed conversations, same-day groups, unknown/early/warmup dates, JF, safe Markdown, account switching and preserved overlays/averages. The unfiltered all-time trend CSV matches the pre-meeting report byte for byte. The browser test fixture and private historical import remain outside Git. Owner-signed-in production testing requires the owner's existing session; no token extraction or impersonation is used.
