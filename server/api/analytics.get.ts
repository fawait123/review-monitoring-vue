import { getAnalyticsData } from "../services/db/analytics";

export default defineEventHandler(async () => {
  return getAnalyticsData();
});
