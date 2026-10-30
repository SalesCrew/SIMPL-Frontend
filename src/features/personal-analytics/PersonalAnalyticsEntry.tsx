import { Component, lazy, Suspense, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { canRequestPersonalAnalytics } from "./access";
import { PersonalAnalyticsSkeleton } from "./PersonalAnalyticsSkeleton";
const PersonalAnalyticsPage = lazy(() => import("./PersonalAnalyticsPage"));
class AnalyticsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <section className="personal-entry-state" role="alert"><h1>Die Darstellung ist gerade nicht verfügbar.</h1><button type="button" className="secondary" onClick={() => window.location.reload()}><RefreshCw size={14} />Erneut laden</button></section>;
    return this.props.children;
  }
}
export function PersonalAnalyticsEntry({ actorId, revision }: { actorId: string; revision?: number }) {
  if (!canRequestPersonalAnalytics(actorId)) return null;
  return <AnalyticsBoundary><Suspense fallback={<PersonalAnalyticsSkeleton />}><PersonalAnalyticsPage actorId={actorId} revision={revision} /></Suspense></AnalyticsBoundary>;
}
