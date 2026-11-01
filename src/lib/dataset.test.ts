import { describe, expect, it } from "vitest";
import { summarize, validateRows } from "./dataset";

describe("CSV validation", () => {
  it("requires an area column", () => {
    const { report } = validateRows([{ foo: "1" }]);
    expect(report.missingRequired).toContain("area");
    expect(report.validRows).toBe(0);
  });
  it("detects duplicate records", () => {
    const { report } = validateRows([
      { area: "A", risk: "low" },
      { area: "A", risk: "low" },
      { area: "B", risk: "high" },
    ]);
    expect(report.duplicates).toBe(1);
    expect(report.validRows).toBe(2);
  });
  it("counts missing values and type errors", () => {
    const { report } = validateRows([
      { area: "A", lat: "abc", incident_rate: "" },
      { area: "B", lat: "12.9", incident_rate: "4" },
    ]);
    expect(report.missingValues["incident_rate"]).toBe(1);
    expect(report.typeErrors).toHaveLength(1);
  });
  it("rejects out-of-range latitude", () => {
    const { report } = validateRows([{ area: "A", latitude: "120" }]);
    expect(report.typeErrors[0]?.column).toBe("latitude");
  });
});

describe("summary", () => {
  it("counts distinct areas and risk distribution", () => {
    const { rows } = validateRows([
      { area: "A", risk: "Low" },
      { area: "A", risk: "High", date: "2024-05-01" },
      { area: "B", risk: "medium" },
    ]);
    const s = summarize(rows);
    expect(s.areas).toBe(2);
    expect(s.distribution).toEqual({ Low: 1, Moderate: 1, High: 1 });
    expect(s.latestDate).toBe("2024-05-01");
  });
});
