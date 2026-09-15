import { getAnalyticsData } from "#server/services/db/analytics";

export default defineEventHandler(() => getAnalyticsData());