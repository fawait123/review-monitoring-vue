import { setModelConfig } from "../../services/db/model-config";

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as {
    providerId?: string;
    modelId?: string;
    thinkingLevel?: string;
  };
  if (!body.providerId || !body.modelId) {
    setResponseStatus(event, 400);
    return { error: "providerId dan modelId wajib diisi" };
  }
  const thinkingLevel = body.thinkingLevel ?? "medium";
  if (!THINKING_LEVELS.includes(thinkingLevel)) {
    setResponseStatus(event, 400);
    return { error: `thinkingLevel harus salah satu dari: ${THINKING_LEVELS.join(", ")}` };
  }
  return await setModelConfig({ providerId: body.providerId, modelId: body.modelId, thinkingLevel });
});