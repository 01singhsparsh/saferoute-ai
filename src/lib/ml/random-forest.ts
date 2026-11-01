/**
 * Random Forest classifier (CART trees, Gini impurity, bootstrap sampling,
 * random feature subsets per split). Mirrors scikit-learn's
 * RandomForestClassifier defaults where practical (max_features="sqrt",
 * bootstrap=True, probability = mean of per-tree leaf class distributions).
 * Pure TypeScript so it runs inside the app's server runtime.
 */

export type Label = "Low" | "Moderate" | "High";
export const LABELS: Label[] = ["Low", "Moderate", "High"];

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Node =
  | { leaf: true; dist: number[] }
  | { leaf: false; feature: number; threshold: number; left: Node; right: Node };

export interface ForestOptions {
  nTrees: number;
  maxDepth: number;
  minSamplesSplit: number;
  maxFeatures: number;
  seed: number;
}

function gini(counts: number[], n: number) {
  if (n === 0) return 0;
  let s = 1;
  for (const c of counts) s -= (c / n) ** 2;
  return s;
}

function distOf(y: number[], idx: number[], k: number) {
  const c = new Array(k).fill(0);
  for (const i of idx) c[y[i]!]++;
  return c.map((v) => v / idx.length);
}

function buildTree(
  X: number[][],
  y: number[],
  idx: number[],
  depth: number,
  opt: ForestOptions,
  k: number,
  rand: () => number,
): Node {
  const dist = distOf(y, idx, k);
  if (depth >= opt.maxDepth || idx.length < opt.minSamplesSplit || dist.some((d) => d === 1)) {
    return { leaf: true, dist };
  }
  const nFeat = X[0]!.length;
  const feats = Array.from({ length: nFeat }, (_, i) => i);
  for (let i = feats.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [feats[i], feats[j]] = [feats[j]!, feats[i]!];
  }
  let best = { score: Infinity, feature: -1, threshold: 0 };
  for (const f of feats.slice(0, opt.maxFeatures)) {
    const sorted = [...idx].sort((a, b) => X[a]![f]! - X[b]![f]!);
    const left = new Array(k).fill(0);
    const right = new Array(k).fill(0);
    for (const i of sorted) right[y[i]!]++;
    for (let p = 0; p < sorted.length - 1; p++) {
      const i = sorted[p]!;
      left[y[i]!]++;
      right[y[i]!]--;
      const a = X[i]![f]!;
      const b = X[sorted[p + 1]!]![f]!;
      if (a === b) continue;
      const nl = p + 1;
      const nr = sorted.length - nl;
      const score = (nl * gini(left, nl) + nr * gini(right, nr)) / sorted.length;
      if (score < best.score) best = { score, feature: f, threshold: (a + b) / 2 };
    }
  }
  if (best.feature < 0) return { leaf: true, dist };
  const l = idx.filter((i) => X[i]![best.feature]! <= best.threshold);
  const r = idx.filter((i) => X[i]![best.feature]! > best.threshold);
  if (!l.length || !r.length) return { leaf: true, dist };
  return {
    leaf: false,
    feature: best.feature,
    threshold: best.threshold,
    left: buildTree(X, y, l, depth + 1, opt, k, rand),
    right: buildTree(X, y, r, depth + 1, opt, k, rand),
  };
}

function predictTree(node: Node, x: number[]): number[] {
  let n = node;
  while (!n.leaf) n = x[n.feature]! <= n.threshold ? n.left : n.right;
  return n.dist;
}

export class RandomForest {
  private trees: Node[] = [];
  private k = LABELS.length;
  importances: number[] = [];
  constructor(public opt: ForestOptions) {}

  fit(X: number[][], y: number[]) {
    const rand = mulberry32(this.opt.seed);
    this.trees = [];
    const counts = new Array(X[0]!.length).fill(0);
    for (let t = 0; t < this.opt.nTrees; t++) {
      const idx = Array.from({ length: X.length }, () => Math.floor(rand() * X.length));
      const tree = buildTree(X, y, idx, 0, this.opt, this.k, rand);
      this.trees.push(tree);
      const walk = (n: Node) => {
        if (n.leaf) return;
        counts[n.feature]++;
        walk(n.left);
        walk(n.right);
      };
      walk(tree);
    }
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    this.importances = counts.map((c) => c / total);
    return this;
  }

  predictProba(x: number[]): number[] {
    const sum = new Array(this.k).fill(0);
    for (const t of this.trees) predictTree(t, x).forEach((p, i) => (sum[i] += p));
    return sum.map((s) => s / this.trees.length);
  }

  predict(x: number[]): number {
    const p = this.predictProba(x);
    return p.indexOf(Math.max(...p));
  }
}
