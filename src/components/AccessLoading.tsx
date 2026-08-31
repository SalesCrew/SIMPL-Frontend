import { RefreshCw } from "lucide-react";
import { BrandLogo } from "./BrandLogo";

/** Presentation only: the account and workspace gates remain in App/useWorkspace. */
export function AccessLoading({
  message = "Zugriffsrechte werden geprüft",
  error,
  retry,
}: {
  message?: string;
  error?: string;
  retry?: () => Promise<void>;
}) {
  return (
    <main className="access-loading" data-state={error ? "error" : "loading"}>
      <div className="access-loading-content">
        <div className="access-loading-brand" role="img" aria-label="SIMPL">
          <BrandLogo />
        </div>
        <div className="access-loading-track" aria-hidden="true"><span /></div>
        <div className="access-loading-status" role="status" aria-live="polite" aria-atomic="true">
          <h1>{error ? "Zugriff konnte nicht geprüft werden" : message}</h1>
        </div>
        {error && <div className="access-loading-recovery">
          <p role="alert">{error}</p>
          {retry && <button className="secondary" type="button" onClick={() => void retry()}>
            <RefreshCw size={14} aria-hidden="true" />
            Erneut versuchen
          </button>}
        </div>}
      </div>
    </main>
  );
}
