import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Activity, CalendarClock, Layers, MapPinned } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useActiveDataset } from "@/hooks/use-active-dataset";
import { DataSourceNotice } from "@/components/dataset-picker";
import { EmptyState, PageHeader, RiskBadge, SectionCard, StatCard, riskColorVar } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { areaStats, summarize } from "@/lib/dataset";
import { LABELS, type Label } from "@/lib/ml/random-forest";
import { Button } from "@/components/ui/button";
import { tooltipStyle } from "@/lib/chart-style";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SafeRoute AI" }, { name: "description", content: "Overview of the active dataset and recent analyses." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { active, isLoading, error } = useActiveDataset();
  const summary = useMemo(() => (active ? summarize(active.rows) : null), [active]);
  const areas = useMemo(() => (active ? areaStats(active.rows) : []), [active]);
  const trend = useMemo(() => {
    if (!active || !summary?.hasDates) return [];
    const m = new Map<string, number>();
    active.rows.forEach((r) => r.date && m.set(r.date.slice(0, 7), (m.get(r.date.slice(0, 7)) ?? 0) + 1));
    return [...m.entries()].sort().map(([month, records]) => ({ month, records }));
  }, [active, summary]);

  const activity = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const [p, s] = await Promise.all([
        supabase.from("predictions").select("id,predicted_label,inputs,created_at").order("created_at", { ascending: false }).limit(6),
        supabase.from("sos_logs").select("id,created_at").order("created_at", { ascending: false }).limit(3),
      ]);
      if (p.error) throw p.error;
      if (s.error) throw s.error;
      return [
        ...p.data.map((x) => ({ id: x.id, kind: "prediction" as const, label: x.predicted_label as Label, at: x.created_at })),
        ...s.data.map((x) => ({ id: x.id, kind: "sos" as const, label: null, at: x.created_at })),
      ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
    },
  });

  if (error) return <EmptyState title="Couldn't load data">{error.message}</EmptyState>;
  if (isLoading || !summary || !active)
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        <Skeleton className="h-72 rounded-xl md:col-span-4" />
      </div>
    );

  const dist = LABELS.map((l) => ({ label: l, count: summary.distribution[l] }));

  return (
    <>
      <PageHeader title="Dashboard" description="All figures are calculated from the active dataset." />
      <DataSourceNotice />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Records analysed" value={summary.records.toLocaleString()} icon={<Layers className="size-4" />} />
        <StatCard label="Areas represented" value={summary.areas} icon={<MapPinned className="size-4" />} />
        <StatCard
          label="High-risk share"
          value={summary.records - summary.unlabeled ? `${((summary.distribution.High / (summary.records - summary.unlabeled)) * 100).toFixed(1)}%` : "—"}
          hint={summary.unlabeled ? `${summary.unlabeled} unlabelled records excluded` : "of labelled records"}
          icon={<Activity className="size-4" />}
        />
        <StatCard
          label="Latest update"
          value={<span className="text-lg">{summary.latestDate ?? (active.updatedAt ? new Date(active.updatedAt).toLocaleDateString() : "—")}</span>}
          hint={summary.latestDate ? "latest record date" : active.isSynthetic ? "synthetic data has no dates" : "upload time (no date column)"}
          icon={<CalendarClock className="size-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Risk distribution" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={dist}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {dist.map((d) => <Cell key={d.label} fill={riskColorVar[d.label]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Recent activity">
          {activity.isLoading ? (
            <Skeleton className="h-40" />
          ) : activity.error ? (
            <p className="text-sm text-destructive">Couldn't load activity.</p>
          ) : !activity.data?.length ? (
            <EmptyState title="No activity yet">
              Run a <Link to="/predict" className="text-primary hover:underline">prediction</Link> to see it here.
            </EmptyState>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {activity.data.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <span>{a.kind === "prediction" ? <>Prediction · <RiskBadge level={a.label} /></> : "SOS simulation"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Crime trend" description="Records per month" className="mt-4">
        {trend.length > 1 ? (
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Line dataKey="records" stroke="var(--cyan)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="No time-series data in this dataset">
            Trends appear when the dataset has a <code>date</code> column covering at least two months.
          </EmptyState>
        )}
      </SectionCard>

      <SectionCard
        title="Area risk overview"
        className="mt-4"
        action={<Button asChild size="sm" variant="outline"><Link to="/analytics">Full analytics</Link></Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-2">Area</th><th>Records</th><th>Avg. incident rate</th><th>Dominant class</th></tr>
            </thead>
            <tbody>
              {areas.slice(0, 10).map((a) => (
                <tr key={a.area} className="border-t">
                  <td className="py-2">{a.area}</td>
                  <td className="font-mono">{a.records}</td>
                  <td className="font-mono">{a.avgIncidentRate?.toFixed(1) ?? "—"}</td>
                  <td><RiskBadge level={a.dominantRisk} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {areas.length > 10 && <p className="mt-2 text-xs text-muted-foreground">Showing 10 of {areas.length} areas.</p>}
        </div>
      </SectionCard>
    </>
  );
}
