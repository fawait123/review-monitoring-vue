import { eq } from "drizzle-orm";
import { db } from "./client";
import { modelConfig } from "./schema";

export interface ModelConfig {
  providerId: string;
  modelId: string;
  thinkingLevel: string;
}

export async function getModelConfig(): Promise<ModelConfig | null> {
  const row = await db().select().from(modelConfig).where(eq(modelConfig.id, 1)).limit(1);
  if (row.length === 0) return null;
  return {
    providerId: row[0]!.providerId,
    modelId: row[0]!.modelId,
    thinkingLevel: row[0]!.thinkingLevel,
  };
}

export async function setModelConfig(cfg: ModelConfig): Promise<ModelConfig> {
  await db()
    .insert(modelConfig)
    .values({ id: 1, ...cfg })
    .onConflictDoUpdate({
      target: modelConfig.id,
      set: { providerId: cfg.providerId, modelId: cfg.modelId, thinkingLevel: cfg.thinkingLevel, updatedAt: new Date() },
    });
  return cfg;
}