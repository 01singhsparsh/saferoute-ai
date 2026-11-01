import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Cell, Tooltip, XAxis, YAxis } from "recharts";
import { useActiveDataset } from "@/hooks/use-active-dataset";
import { DataSourceNotice } from "@/components/dataset-picker";
import { EmptyState, PageHeader, SectionCard, riskColorVar } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { areaStats, summarize, toCsv } from "@/lib/dataset";
import { LABELS } from "@/lib/ml/random-forest";
import { tooltipStyle } from "@/lib/chart-style";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — SafeRoute AI" }, { name: "description", content: "Risk distribution, area comparisons and trends from the active dataset." }] }),
  component: Analytics,
});

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Analytics() {
  const { active, isLoading } = useActiveDataset();
  const [area, setArea] = useState("all");
  const [risk, setRisk] = useState("all");
  const [crimeType, setCrimeType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const all = active?.rows ?? [];
  const base = useMemo(() => summarize(all), [all]);
  const areaNames = useMemo(() => [...new Set(all.map((r) => r.area))].sort(), [all]);
  const types = useMemo(() => [...new Set(all.map((r) => r.crime_type).filter(Boolean) as string[])].sort(), [all]);

  const rows = useMemo(
    () =>
      all.filter(
        (r) =>
          (area === "all" || r.area === area) &&
          (risk === "all" || r.risk_level === risk) &&
          (crimeType === "all" || r.crime_type === crimeType) &&
          (!from || (r.date && r.date >= from)) &&
          (!to || (r.date && r.date <= to)),
      ),
    [all, area, risk, crimeType, from, to],
  );
  const s = useMemo(() => summarize(rows), [rows]);
  const areas = useMemo(() => areaStats(rows), [rows]);
  const byType = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => r.crime_type && m.set(r.crime_type, (m.get(r.crime_type) ?? 0) + 1));
    return [...m.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count).slice(0, 12);
  }, [rows]);
  const byMonth = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    rows.forEach((r) => {
      if (!r.date) return;
      const k = r.date.slice(0, 7);
      const e = m.get(k) ?? { Low: 0, Moderate: 0, High: 0 };
      if (r.risk_level) e[r.risk_level] = (e[r.risk_level] ?? 0) + 1;
      m.set(k, e);
    });
    return [...m.entries()].sort().map(([month, v]) => ({ month, ...v }));
  }, [rows]);

  if (isLoading || !active) return <Skeleton className="h-96 rounded-xl" />;

  const pie = LABELS.map((l) => ({ name: l, value: s.distribution[l] })).filter((d) => d.value > 0);

  return (
    <>
      <PageHeader
        title="Analytics & insights"
        description={`${rows.length.toLocaleString()} of ${all.length.toLocaleString()} records match your filters`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!rows.length}
              onClick={() => download(`saferoute-records-${active.id}.csv`, toCsv(rows as unknown as Record<string, unknown>[]))}>
              <Download /> Filtered records
            </Button>
            <Button size="sm" disabled={!areas.length}
              onClick={() =>
                download(`saferoute-area-report-${active.id}.csv`,
                  `# SafeRoute AI area report\n# Source: ${active.sourceLabel}\n# Generated: ${new Date().toISOString()}\n` +
                  toCsv(areas.map((a) => ({ area: a.area, records: a.records, avg_density: a.avgDensity?.toFixed(1) ?? "", avg_incident_rate: a.avgIncidentRate?.toFixed(2) ?? "", low: a.counts.Low, moderate: a.counts.Moderate, high: a.counts.High, dominant: a.dominantRisk ?? "" }))))
              }>
              <Download /> Area report
            </Button>
          </div>
        }
      />
      <DataSourceNotice />

      <div className="glass mb-4 grid gap-3 rounded-xl p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger aria-label="Filter by area"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All areas</SelectItem>
            {areaNames.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={risk} onValueChange={setRisk}>
          <SelectTrigger aria-label="Filter by risk"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risk classes</SelectItem>
            {LABELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={crimeType} onValueChange={setCrimeType} disabled={!base.hasCrimeType}>
          <SelectTrigger aria-label="Filter by crime type"><SelectValue placeholder="Crime type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{base.hasCrimeType ? "All crime types" : "No crime-type column"}</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={!base.hasDates} />
        <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} disabled={!base.hasDates} />
      </div>

      {!rows.length ? (
        <EmptyState title="No records match these filters" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Risk category distribution">
            <div className="h-64">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3} stroke="none">
                    {pie.map((d) => <Cell key={d.name} fill={riskColorVar[d.name as keyof typeof riskColorVar]} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {s.unlabeled > 0 && <p className="text-xs text-muted-foreground">{s.unlabeled} unlabelled records not shown.</p>}
          </SectionCard>

          <SectionCard title="Area comparison" description="Average reported incident rate (top 15 areas)">
            {areas.some((a) => a.avgIncidentRate != null) ? (
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={[...areas].filter((a) => a.avgIncidentRate != null).sort((a, b) => b.avgIncidentRate! - a.avgIncidentRate!).slice(0, 15)} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis type="category" dataKey="area" stroke="var(--muted-foreground)" fontSize={11} width={110} />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => v.toFixed(2)} />
                    <Bar dataKey="avgIncidentRate" name="Avg. incident rate" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState title="No incident_rate column in this dataset" />}
          </SectionCard>

          <SectionCard title="Crime-type analysis">
            {byType.length ? (
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={byType}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="type" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" fill="var(--cyan)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState title="Not supported by this dataset">Add a <code>crime_type</code> column to enable this chart.</EmptyState>}
          </SectionCard>

          <SectionCard title="Time-based analysis" description="Records per month by risk class">
            {byMonth.length > 1 ? (
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={byMonth}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} />
                    <Legend />
                    {LABELS.map((l) => <Line key={l} dataKey={l} stroke={riskColorVar[l]} strokeWidth={2} dot={false} />)}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState title="No valid time-series data">Needs a <code>date</code> column covering at least two months.</EmptyState>}
          </SectionCard>
        </div>
      )}
    </>
  );
}
