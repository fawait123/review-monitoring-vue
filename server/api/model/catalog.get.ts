import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { configPaths } from "#server/services/model-config-paths";

export default defineEventHandler(async () => {
  const { modelsPath, authPath } = configPaths();
  const runtime = await ModelRuntime.create({ modelsPath, authPath });

  const available = await runtime.getAvailable();
  // custom models dari models.json: providerId undefined, tapi `provider` terisi
  const availableKeys = new Set(available.map((m) => `${m.provider}/${m.id}`));

  // providerIds() termasuk provider custom dari models.json; getProviders() hanya builtin.
  const providerIds = runtime.getProviders().map((p) => p.id)
  const providers = [...providerIds].map((id) => {
    const models = runtime.getModels(id) ?? [];
    return {
      id,
      name: runtime.getProvider(id)?.name ?? id,
      models: models.map((m: any) => ({
        id: m.id,
        name: m.name,
        reasoning: m.reasoning ?? false,
        available: availableKeys.has(`${id}/${m.id}`),
      })),
    };
  });

  return { providers: providers.filter((p) => p.models.length > 0) };
});