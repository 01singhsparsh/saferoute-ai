import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FEATURES, MODEL_VERSION, generateSyntheticDataset, getModel, predictOne } from "@/lib/ml/model";

const inputSchema = z.object({
  population_density: z.number().finite().min(FEATURES[0].min).max(FEATURES[0].max),
  incident_rate: z.number().finite().min(FEATURES[1].min).max(FEATURES[1].max),
});

export const getModelInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { metrics, forest } = getModel();
  return {
    version: MODEL_VERSION,
    algorithm: "Random Forest Classifier (CART, Gini, bootstrap)",
    implementation: "TypeScript port running in the app server (not scikit-learn)",
    hyperparameters: forest.opt,
    features: FEATURES.map((f) => ({ ...f })),
    featureImportance: FEATURES.map((f, i) => ({ key: f.key, label: f.label, share: forest.importances[i] })),
    labels: ["Low", "Moderate", "High"],
    trainingData: "Synthetic, 240 generated records (not real crime data)",
    metrics,
    probabilityNote:
      "Vote shares are the fraction of trees agreeing. They are not calibrated probabilities.",
  };
});

export const getSyntheticDataset = createServerFn({ method: "GET" }).handler(async () => {
  return generateSyntheticDataset();
});

export const predictRisk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const result = predictOne(data.population_density, data.incident_rate);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("predictions").insert({
      user_id: context.userId,
      inputs: data,
      predicted_label: result.label,
      probabilities: result.voteShare,
      model_version: MODEL_VERSION,
    });
    if (error) console.error("prediction history insert failed", error);
    return { ...result, modelVersion: MODEL_VERSION, savedToHistory: !error };
  });

export const classifyRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rows: z.array(z.tuple([z.number().finite(), z.number().finite()])).max(20000) }).parse(input),
  )
  .handler(async ({ data }) => {
    return {
      labels: data.rows.map(([d, r]) => predictOne(d, r).label),
      modelVersion: MODEL_VERSION,
    };
  });
