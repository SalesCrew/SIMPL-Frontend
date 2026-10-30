import "./personal-analytics-skeleton.css";

/** Shared by the permission check, lazy entry and first data request. Contains no task data. */
export function PersonalAnalyticsSkeleton() {
  return <section className="personal-analytics-skeleton" aria-label="Persönlicher Fortschritt" aria-busy="true">
    <div className="personal-skeleton-wrap">
      <header className="personal-skeleton-header">
        <h1>Dein Fortschritt</h1>
        <p role="status">Deine Übersicht wird geladen …</p>
      </header>
      <div className="personal-skeleton-content" aria-hidden="true">
        <div className="personal-skeleton-filters">
          <span className="personal-skeleton-block" />
          <span className="personal-skeleton-block" />
          <span className="personal-skeleton-block" />
          <span className="personal-skeleton-block" />
        </div>
        <div className="personal-skeleton-metrics">
          {[0, 1, 2, 3].map(index => <div className="personal-skeleton-card" key={index}>
            <span className="personal-skeleton-block personal-skeleton-label" />
            <span className="personal-skeleton-block personal-skeleton-value" />
            <span className="personal-skeleton-block personal-skeleton-note" />
          </div>)}
        </div>
        <div className="personal-skeleton-charts">
          <div className="personal-skeleton-card personal-skeleton-main-chart">
            <span className="personal-skeleton-block personal-skeleton-title" />
            <span className="personal-skeleton-block personal-skeleton-note" />
            <span className="personal-skeleton-block personal-skeleton-select" />
            <div className="personal-skeleton-grid" />
          </div>
          <div className="personal-skeleton-card personal-skeleton-breakdown">
            <span className="personal-skeleton-block personal-skeleton-title" />
            {[0, 1, 2, 3, 4].map(index => <div className="personal-skeleton-row" key={index}>
              <span className="personal-skeleton-block personal-skeleton-label" />
              <span className="personal-skeleton-block personal-skeleton-bar" />
            </div>)}
          </div>
        </div>
        <div className="personal-skeleton-card personal-skeleton-daily">
          <span className="personal-skeleton-block personal-skeleton-title" />
          <span className="personal-skeleton-block personal-skeleton-note" />
          <div className="personal-skeleton-grid" />
        </div>
      </div>
    </div>
  </section>;
}
