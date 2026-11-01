/** CSV dataset normalisation, validation and summary maths (browser-safe). */
import type { Label } from "@/lib/ml/random-forest";

export const KNOWN_COLUMNS = {
  area: { type: "string", required: true },
  population_density: { type: "number", required: false },
  incident_rate: { type: "number", required: false },
  risk_level: { type: "risk", required: false },
  latitude: { type: "number", required: false },
  longitude: { type: "number", required: false },
  date: { type: "date", required: false },
  crime_type: { type: "string", required: false },
} as const;

export type ColumnKey = keyof typeof KNOWN_COLUMNS;

export interface DataRow {
  area: string;
  population_density?: number | null;
  incident_rate?: number | null;
  risk_level?: Label | null;
  risk_source?: "dataset" | "model";
  latitude?: number | null;
  longitude?: number | null;
  date?: string | null;
  crime_type?: string | null;
}

export interface ValidationReport {
  columns: string[];
  recognized: ColumnKey[];
  ignored: string[];
  missingRequired: ColumnKey[];
  missingValues: Record<string, number>;
  typeErrors: { row: number; column: string; value: string }[];
  duplicates: number;
  totalRows: number;
  validRows: number;
}

export function normalizeHeader(h: string) {
  return h
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const ALIASES: Record<string, ColumnKey> = {
  area_name: "area",
  location: "area",
  zone: "area",
  density: "population_density",
  incidents_per_1000: "incident_rate",
  crime_rate: "incident_rate",
  risk: "risk_level",
  risk_category: "risk_level",
  lat: "latitude",
  lng: "longitude",
  lon: "longitude",
  long: "longitude",
  type: "crime_type",
  category: "crime_type",
};

export function normalizeRisk(v: string): Label | null {
  const s = v.trim().toLowerCase();
  if (["low", "0", "low risk"].includes(s)) return "Low";
  if (["moderate", "medium", "1", "moderate risk", "medium risk"].includes(s)) return "Moderate";
  if (["high", "2", "high risk"].includes(s)) return "High";
  return null;
}

export function validateRows(raw: Record<string, string>[]): {
  rows: DataRow[];
  report: ValidationReport;
} {
  const columns = [...new Set(raw.flatMap((r) => Object.keys(r)))];
  const map = new Map<string, ColumnKey>();
  const ignored: string[] = [];
  for (const c of columns) {
    const n = normalizeHeader(c);
    const key = (n in KNOWN_COLUMNS ? n : ALIASES[n]) as ColumnKey | undefined;
    if (key && ![...map.values()].includes(key)) map.set(c, key);
    else ignored.push(c);
  }
  const recognized = [...map.values()];
  const missingRequired = (Object.keys(KNOWN_COLUMNS) as ColumnKey[]).filter(
    (k) => KNOWN_COLUMNS[k].required && !recognized.includes(k),
  );
  const missingValues: Record<string, number> = {};
  const typeErrors: ValidationReport["typeErrors"] = [];
  const rows: DataRow[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  raw.forEach((r, i) => {
    const sig = JSON.stringify(columns.map((c) => (r[c] ?? "").trim()));
    if (seen.has(sig)) {
      duplicates++;
      return;
    }
    seen.add(sig);
    const out: DataRow = { area: "" };
    let ok = true;
    for (const [orig, key] of map) {
      const v = (r[orig] ?? "").trim();
      if (v === "") {
        missingValues[key] = (missingValues[key] ?? 0) + 1;
        if (KNOWN_COLUMNS[key].required) ok = false;
        continue;
      }
      const t = KNOWN_COLUMNS[key].type;
      if (t === "number") {
        const n = Number(v.replace(/,/g, ""));
        if (!Number.isFinite(n)) {
          typeErrors.push({ row: i + 2, column: key, value: v });
          continue;
        }
        if (key === "latitude" && (n < -90 || n > 90)) {
          typeErrors.push({ row: i + 2, column: key, value: v });
          continue;
        }
        if (key === "longitude" && (n < -180 || n > 180)) {
          typeErrors.push({ row: i + 2, column: key, value: v });
          continue;
        }
        (out as unknown as Record<string, unknown>)[key] = n;
      } else if (t === "risk") {
        const l = normalizeRisk(v);
        if (!l) typeErrors.push({ row: i + 2, column: key, value: v });
        else {
          out.risk_level = l;
          out.risk_source = "dataset";
        }
      } else if (t === "date") {
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) typeErrors.push({ row: i + 2, column: key, value: v });
        else out.date = d.toISOString().slice(0, 10);
      } else {
        (out as unknown as Record<string, unknown>)[key] = v;
      }
    }
    if (ok && out.area) rows.push(out);
  });

  return {
    rows,
    report: {
      columns,
      recognized,
      ignored,
      missingRequired,
      missingValues,
      typeErrors,
      duplicates,
      totalRows: raw.length,
      validRows: missingRequired.length ? 0 : rows.length,
    },
  };
}

export interface DatasetSummary {
  records: number;
  areas: number;
  distribution: Record<Label, number>;
  unlabeled: number;
  hasGeo: boolean;
  hasDates: boolean;
  hasCrimeType: boolean;
  latestDate: string | null;
}

export function summarize(rows: DataRow[]): DatasetSummary {
  const distribution: Record<Label, number> = { Low: 0, Moderate: 0, High: 0 };
  let unlabeled = 0;
  let latest: string | null = null;
  for (const r of rows) {
    if (r.risk_level) distribution[r.risk_level]++;
    else unlabeled++;
    if (r.date && (!latest || r.date > latest)) latest = r.date;
  }
  return {
    records: rows.length,
    areas: new Set(rows.map((r) => r.area)).size,
    distribution,
    unlabeled,
    hasGeo: rows.some((r) => r.latitude != null && r.longitude != null),
    hasDates: rows.some((r) => !!r.date),
    hasCrimeType: rows.some((r) => !!r.crime_type),
    latestDate: latest,
  };
}

export interface AreaStat {
  area: string;
  records: number;
  avgDensity: number | null;
  avgIncidentRate: number | null;
  dominantRisk: Label | null;
  counts: Record<Label, number>;
}

export function areaStats(rows: DataRow[]): AreaStat[] {
  const g = new Map<string, DataRow[]>();
  for (const r of rows) g.set(r.area, [...(g.get(r.area) ?? []), r]);
  const avg = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => typeof x === "number");
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  return [...g.entries()]
    .map(([area, rs]) => {
      const counts: Record<Label, number> = { Low: 0, Moderate: 0, High: 0 };
      rs.forEach((r) => r.risk_level && counts[r.risk_level]++);
      const max = Math.max(counts.Low, counts.Moderate, counts.High);
      const dominantRisk = max === 0 ? null : (["High", "Moderate", "Low"] as Label[]).find((l) => counts[l] === max)!;
      return {
        area,
        records: rs.length,
        avgDensity: avg(rs.map((r) => r.population_density)),
        avgIncidentRate: avg(rs.map((r) => r.incident_rate)),
        dominantRisk,
        counts,
      };
    })
    .sort((a, b) => a.area.localeCompare(b.area));
}

export function toCsv(rows: Record<string, unknown>[]) {
  const first = rows[0];
  if (!first) return "";
  const cols = Object.keys(first);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
