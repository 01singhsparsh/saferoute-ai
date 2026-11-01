import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { Info, Loader2, Search, X } from "lucide-react";
import { useActiveDataset } from "@/hooks/use-active-dataset";
import { DataSourceNotice } from "@/components/dataset-picker";
import { DemoBadge, PageHeader, RiskBadge, SectionCard, riskColorVar } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { LABELS, type Label } from "@/lib/ml/random-forest";
import type { MapPoint } from "@/components/risk-map";

const RiskMap = lazy(() => import("@/components/risk-map"));

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({ meta: [{ title: "Risk Map — SafeRoute AI" }, { name: "description", content: "Interactive map of geo-referenced records in the active dataset." }] }),
  component: MapPage,
});

function MapPage() {
  const { active, isLoading } = useActiveDataset();
  const [filters, setFilters] = useState<Record<Label, boolean>>({ Low: true, Moderate: true, High: true });
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom?: number; bbox?: [number, number, number, number] } | null>(null);
  const [selected, setSelected] = useState<MapPoint | null>(null);

  const allPoints = useMemo<MapPoint[]>(
    () =>
      (active?.rows ?? [])
        .map((r, i) => ({ ...r, _i: i }))
        .filter((r): r is MapPoint => typeof r.latitude === "number" && typeof r.longitude === "number"),
    [active],
  );
  const points = useMemo(() => allPoints.filter((p) => !p.risk_level || filters[p.risk_level]), [allPoints, filters]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const local = allPoints.find((p) => p.area.toLowerCase().includes(q.toLowerCase()));
    if (local) {
      setFocus({ lat: local.latitude, lng: local.longitude, zoom: 15 });
      setSelected(local);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = (await res.json()) as { lat: string; lon: string; boundingbox: string[]; display_name: string }[];
      const match = data[0];
      if (!match) {
        toast.info("No matching place found");
        return;
      }
      const b = match.boundingbox.map(Number) as [number, number, number, number];
      setFocus({ lat: Number(match.lat), lng: Number(match.lon), bbox: b });
      toast.success(`Moved to ${match.display_name.split(",").slice(0, 2).join(",")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  if (isLoading || !active) return <Skeleton className="h-[70vh] rounded-xl" />;

  return (
    <>
      <PageHeader title="Interactive risk map" description="Shows only records that include their own latitude and longitude. No coordinates are made up." />
      <DataSourceNotice />
      {!allPoints.length && (
        <div className="mb-4 flex gap-3 rounded-lg border border-risk-moderate/30 bg-demo p-4 text-sm text-demo-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">No geographic records in this dataset</p>
            <p className="mt-1 opacity-90">
              {active.isSynthetic ? "The synthetic training set has no locations, so it can't be mapped. " : ""}
              Mapping by location needs verified coordinates. <Link to="/datasets" className="underline">Upload a CSV</Link> with{" "}
              <code>latitude</code> and <code>longitude</code> columns. You can still search places and explore the base map.
            </p>
          </div>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="glass relative h-[60vh] min-h-[420px] overflow-hidden rounded-xl">
          <form onSubmit={search} className="absolute left-14 right-3 top-3 z-[500] flex max-w-md gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search an area or place…" className="bg-popover/95" aria-label="Search location" />
            <Button type="submit" size="icon" disabled={searching} aria-label="Search">{searching ? <Loader2 className="animate-spin" /> : <Search />}</Button>
          </form>
          <ClientOnly fallback={<Skeleton className="h-full w-full" />}>
            <Suspense fallback={<Skeleton className="h-full w-full" />}>
              <RiskMap points={points} focus={focus} onSelect={setSelected} />
            </Suspense>
          </ClientOnly>
        </div>
        <div className="space-y-4">
          <SectionCard title="Legend & filters">
            <div className="space-y-2.5">
              {LABELS.map((l) => (
                <label key={l} className="flex cursor-pointer items-center gap-3 text-sm">
                  <Checkbox checked={filters[l]} onCheckedChange={(v) => setFilters((f) => ({ ...f, [l]: !!v }))} />
                  <span className="size-3 rounded-full" style={{ background: riskColorVar[l] }} />
                  {l} risk
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{allPoints.filter((p) => p.risk_level === l).length}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{points.length} of {allPoints.length} mapped records shown</p>
          </SectionCard>
          <SectionCard title="Selected area" action={selected && <Button size="icon" variant="ghost" aria-label="Clear selection" onClick={() => setSelected(null)}><X /></Button>}>
            {selected ? (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Area</dt><dd className="text-right font-medium">{selected.area}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Risk</dt><dd><RiskBadge level={selected.risk_level} /></dd></div>
                {selected.risk_source === "model" && <p className="text-xs text-cyan">Risk class estimated by the model</p>}
                {selected.population_density != null && <div className="flex justify-between"><dt className="text-muted-foreground">Density</dt><dd className="font-mono">{selected.population_density}</dd></div>}
                {selected.incident_rate != null && <div className="flex justify-between"><dt className="text-muted-foreground">Incident rate</dt><dd className="font-mono">{selected.incident_rate}</dd></div>}
                {selected.crime_type && <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd>{selected.crime_type}</dd></div>}
                {selected.date && <div className="flex justify-between"><dt className="text-muted-foreground">Date</dt><dd className="font-mono">{selected.date}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted-foreground">Coordinates</dt><dd className="font-mono text-xs">{selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}</dd></div>
                {!active.isVerified && <DemoBadge>Unverified source</DemoBadge>}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Click a marker to see its details.</p>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
