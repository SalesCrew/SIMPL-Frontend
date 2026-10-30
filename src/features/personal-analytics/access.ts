// Navigation convenience only; the Express API independently verifies this ID.
export const PERSONAL_ANALYTICS_OWNER_ID = "e68b62cd-06b3-4300-8a16-dc04e20ed75d";
export const canRequestPersonalAnalytics = (id: string | null | undefined) => id === PERSONAL_ANALYTICS_OWNER_ID;
