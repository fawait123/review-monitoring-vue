import { getModelConfig } from "#server/services/db/model-config";

export default defineEventHandler(async () => {
  return await getModelConfig();
});