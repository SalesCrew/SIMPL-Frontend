import { describe, expect, it } from "vitest";
import { canRequestPersonalAnalytics, PERSONAL_ANALYTICS_OWNER_ID } from "./access";
describe("private analytics navigation identity", () => {
  it("accepts only the verified immutable account ID", () => {
    expect(canRequestPersonalAnalytics(PERSONAL_ANALYTICS_OWNER_ID)).toBe(true);
    for (const id of [null,undefined,"","kilian","Kilian Sternath","kilian.sternath@salescrew.at","admin","00000000-0000-4000-8000-000000000001",PERSONAL_ANALYTICS_OWNER_ID.toUpperCase()]) expect(canRequestPersonalAnalytics(id)).toBe(false);
  });
});
