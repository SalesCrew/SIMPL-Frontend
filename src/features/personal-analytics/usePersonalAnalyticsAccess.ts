import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../../data";
import { canRequestPersonalAnalytics } from "./access";
type Access = { id: string; status: "checking" | "allowed" | "failed" };
export function usePersonalAnalyticsAccess(id: string | null, authorizationVersion?: number) {
  const [request, setRequest] = useState<Access | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!canRequestPersonalAnalytics(id)) { setRequest(null); return; }
    let active = true;
    setRequest({ id: id!, status: "checking" });
    void apiRequest("/personal-analytics/access", "GET").then(result => {
      if (active) setRequest({ id: id!, status: result?.allowed === true ? "allowed" : "failed" });
    }, () => { if (active) setRequest({ id: id!, status: "failed" }); });
    return () => { active = false; };
  }, [id, authorizationVersion, attempt]);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  if (!canRequestPersonalAnalytics(id)) return { status: "denied" as const, retry };
  return { status: request?.id === id ? request.status : "checking" as const, retry };
}
