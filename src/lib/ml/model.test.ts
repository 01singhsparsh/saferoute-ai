import { describe, expect, it } from "vitest";
import { generateSyntheticDataset, getModel, predictOne } from "./model";

describe("synthetic dataset", () => {
  it("has exactly 240 records", () => {
    expect(generateSyntheticDataset()).toHaveLength(240);
  });
  it("only uses the three risk classes", () => {
    const labels = new Set(generateSyntheticDataset().map((r) => r.risk_level));
    for (const l of labels) expect(["Low", "Moderate", "High"]).toContain(l);
  });
});

describe("random forest", () => {
  it("is deterministic", () => {
    expect(predictOne(9000, 30)).toEqual(predictOne(9000, 30));
  });
  it("uses an 80/20 train/test split", () => {
    const { metrics } = getModel();
    expect(metrics.trainSize).toBe(192);
    expect(metrics.testSize).toBe(48);
  });
  it("classifies obvious extremes", () => {
    expect(predictOne(600, 2).label).toBe("Low");
    expect(predictOne(19000, 75).label).toBe("High");
  });
  it("vote shares sum to 1", () => {
    const v = predictOne(8000, 25).voteShare;
    expect(v.Low + v.Moderate + v.High).toBeCloseTo(1, 6);
  });
});
