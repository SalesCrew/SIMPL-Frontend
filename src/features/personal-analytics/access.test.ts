import { describe, expect, it, vi } from "vitest";
import { canRequestPersonalAnalytics, PERSONAL_ANALYTICS_OWNER_ID, initiallyRequestedPersonalAnalytics, writePersonalAnalyticsLocation } from "./access";
describe("private analytics navigation identity", () => {
  it("accepts only the verified immutable account ID", () => {
    expect(canRequestPersonalAnalytics(PERSONAL_ANALYTICS_OWNER_ID)).toBe(true);
    for (const id of [null,undefined,"","kilian","Kilian Sternath","kilian.sternath@salescrew.at","admin","00000000-0000-4000-8000-000000000001",PERSONAL_ANALYTICS_OWNER_ID.toUpperCase()]) expect(canRequestPersonalAnalytics(id)).toBe(false);
  });
  it("does not assume an authenticated browser during initial rendering", () => { expect(initiallyRequestedPersonalAnalytics()).toBe(false); expect(() => writePersonalAnalyticsLocation(true)).not.toThrow(); });
  it("only consumes its own view parameter and preserves card deep links and hashes", () => {
    const replaceState=vi.fn();vi.stubGlobal("window",{location:{href:"https://example.invalid/?card=card-id&source=mail#section",search:"?card=card-id&source=mail"},history:{state:{preserved:true},replaceState}});
    writePersonalAnalyticsLocation(true);expect(replaceState).toHaveBeenCalledWith({preserved:true},"","/?card=card-id&source=mail&view=insights#section");
    vi.stubGlobal("window",{location:{href:"https://example.invalid/?card=card-id&view=insights#section",search:"?card=card-id&view=insights"},history:{state:null,replaceState}});
    expect(initiallyRequestedPersonalAnalytics()).toBe(true);writePersonalAnalyticsLocation(false);expect(replaceState).toHaveBeenLastCalledWith(null,"","/?card=card-id#section");vi.unstubAllGlobals();
  });
});
