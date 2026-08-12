import { getModelConfig } from "../../services/db/model-config";

export default defineEventHandler(async () => {
  return await getModelConfig();
});