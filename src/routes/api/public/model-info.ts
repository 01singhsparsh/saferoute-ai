import { createFileRoute } from "@tanstack/react-router";
import { FEATURES, MODEL_VERSION, getModel } from "@/lib/ml/model";

export const Route = createFileRoute("/api/public/model-info")({
  server: {
    handlers: {
      GET: async () => {
        const { metrics } = getModel();
        return Response.json({
          model_version: MODEL_VERSION,
          features: FEATURES,
          labels: ["Low", "Moderate", "High"],
          training_data: "synthetic",
          test_accuracy: metrics.accuracy,
          train_size: metrics.trainSize,
          test_size: metrics.testSize,
        });
      },
    },
  },
});
