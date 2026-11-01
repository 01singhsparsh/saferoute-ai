/**
 * Synthetic training data + trained model. Isomorphic and deterministic
 * (seeded) so the server and tests produce the exact same model.
 *
 * FEATURES ARE PROVISIONAL: the original academic project's two input
 * features were not supplied. Replace FEATURES + generateSyntheticDataset
 * once the original dataset/training script is uploaded.
 */
import { LABELS, RandomForest, mulberry32, type Label } from "./random-forest";

export const MODEL_VERSION = "rf-synthetic-0.1.0";

export const FEATURES = [
  {
    key: "population_density",
    label: "Population density",
    unit: "people / km²",
    min: 100,
    max: 20000,
  },
  {
    key: "incident_rate",
    label: "Reported incident rate",
    unit: "per 1,000 residents / year",
    min: 0,
    max: 80,
  },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];

export interface SyntheticRecord {
  area: string;
  population_density: number;
  incident_rate: number;
  risk_level: Label;
}

/** 240 synthetic records across 24 fictional zones. Not real crime data. */
export function generateSyntheticDataset(seed = 42): SyntheticRecord[] {
  const rand = mulberry32(seed);
  const gauss = () => {
    const u = Math.max(rand(), 1e-9);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const out: SyntheticRecord[] = [];
  for (let i = 0; i < 240; i++) {
    const zone = (i % 24) + 1;
    const density = Math.round(Math.min(20000, Math.max(100, 500 + rand() * 14500)));
    const rate = Math.round(Math.min(80, Math.max(0, 2 + rand() * 58)) * 10) / 10;
    const score = 0.4 * (density / 15000) + 0.6 * (rate / 60) + gauss() * 0.06;
    const risk_level: Label = score < 0.38 ? "Low" : score < 0.62 ? "Moderate" : "High";
    out.push({
      area: `Synthetic Zone ${String(zone).padStart(2, "0")}`,
      population_density: density,
      incident_rate: rate,
      risk_level,
    });
  }
  return out;
}

export interface ModelBundle {
  forest: RandomForest;
  metrics: {
    trainSize: number;
    testSize: number;
    accuracy: number;
    perClass: { label: Label; precision: number; recall: number; f1: number; support: number }[];
    confusion: number[][];
  };
}

let cached: ModelBundle | null = null;

export function getModel(): ModelBundle {
  if (cached) return cached;
  const data = generateSyntheticDataset();
  const rand = mulberry32(7);
  const order = data.map((_, i) => i).sort(() => rand() - 0.5);
  const cut = Math.floor(data.length * 0.8);
  const toX = (r: SyntheticRecord) => [r.population_density, r.incident_rate];
  const toY = (r: SyntheticRecord) => LABELS.indexOf(r.risk_level);
  const train = order.slice(0, cut).map((i) => data[i]!);
  const test = order.slice(cut).map((i) => data[i]!);
  const forest = new RandomForest({
    nTrees: 100,
    maxDepth: 8,
    minSamplesSplit: 2,
    maxFeatures: 1,
    seed: 42,
  }).fit(train.map(toX), train.map(toY));

  const confusion = LABELS.map(() => LABELS.map(() => 0));
  let correct = 0;
  for (const r of test) {
    const p = forest.predict(toX(r));
    const t = toY(r);
    confusion[t]![p]!++;
    if (p === t) correct++;
  }
  const perClass = LABELS.map((label, c) => {
    const tp = confusion[c]![c]!;
    const fp = confusion.reduce((s, row, i) => s + (i === c ? 0 : row[c]!), 0);
    const fn = confusion[c]!.reduce((s, v, i) => s + (i === c ? 0 : v), 0);
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { label, precision, recall, f1, support: tp + fn };
  });
  cached = {
    forest,
    metrics: {
      trainSize: train.length,
      testSize: test.length,
      accuracy: correct / test.length,
      perClass,
      confusion,
    },
  };
  return cached;
}

export function predictOne(population_density: number, incident_rate: number) {
  const { forest } = getModel();
  const proba = forest.predictProba([population_density, incident_rate]);
  const idx = proba.indexOf(Math.max(...proba));
  return {
    label: LABELS[idx]!,
    voteShare: Object.fromEntries(LABELS.map((l, i) => [l, proba[i]])) as Record<Label, number>,
  };
}
