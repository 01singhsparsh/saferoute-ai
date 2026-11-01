import { createFileRoute } from "@tanstack/react-router";
import { MODEL_VERSION } from "@/lib/ml/model";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ status: "ok", model_version: MODEL_VERSION, time: new Date().toISOString() }),
    },
  },
});
