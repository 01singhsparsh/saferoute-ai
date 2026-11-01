import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { FEATURES, MODEL_VERSION, predictOne } from "@/lib/ml/model";

const schema = z.object({
  population_density: z.number().finite().min(FEATURES[0].min).max(FEATURES[0].max),
  incident_rate: z.number().finite().min(FEATURES[1].min).max(FEATURES[1].max),
});

// Stateless public prediction endpoint. Stores nothing and returns no user data.
export const Route = createFileRoute("/api/public/predict")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Body must be JSON" }, { status: 400 });
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid input", issues: parsed.error.issues }, { status: 422 });
        }
        const r = predictOne(parsed.data.population_density, parsed.data.incident_rate);
        return Response.json({
          risk_level: r.label,
          vote_share: r.voteShare,
          model_version: MODEL_VERSION,
          disclaimer: "Analytical estimate from a model trained on synthetic data. Not a safety guarantee.",
        });
      },
    },
  },
});
