import { listPrds } from "#server/services/db/prds";

export default defineEventHandler(async () => {
  const prds = await listPrds();
  return { prds };
});
