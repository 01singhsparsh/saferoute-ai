import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { CheckCircle2, FileUp, Loader2, RefreshCw, Trash2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { classifyRows } from "@/lib/ml.functions";
import { KNOWN_COLUMNS, summarize, validateRows, type DataRow, type ValidationReport } from "@/lib/dataset";
import { datasetsQueryKey, useActiveDataset } from "@/hooks/use-active-dataset";
import { DemoBadge, EmptyState, PageHeader, RiskBadge, SectionCard } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/datasets")({
  head: () => ({ meta: [{ title: "Datasets — SafeRoute AI" }, { name: "description", content: "Upload, validate and manage crime-related CSV datasets." }] }),
  component: Datasets,
});

const MAX_BYTES = 5 * 1024 * 1024;
type Parsed = { file: File; rows: DataRow[]; report: ValidationReport };

function Datasets() {
  const qc = useQueryClient();
  const classify = useServerFn(classifyRows);
  const { datasets, selectedId, setSelectedId } = useActiveDataset();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please choose a .csv file");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File is larger than 5 MB");
      return;
    }
    setParsing(true);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (res) => {
        setParsing(false);
        if (res.errors.length && !res.data.length) {
          toast.error(`Couldn't read CSV: ${res.errors[0]?.message ?? "unknown error"}`);
          return;
        }
        const { rows, report } = validateRows(res.data);
        setParsed({ file, rows, report });
        if (!name) setName(file.name.replace(/\.csv$/i, ""));
      },
      error: (err) => {
        setParsing(false);
        toast.error(err.message);
      },
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!parsed) throw new Error("No file");
      if (parsed.report.missingRequired.length) throw new Error("Fix the missing required columns first");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      let rows = parsed.rows;
      // Fill missing risk labels using the model when both features exist.
      const need = rows.map((r, i) => [r, i] as const).filter(([r]) => !r.risk_level && r.population_density != null && r.incident_rate != null);
      if (need.length) {
        const res = await classify({ data: { rows: need.map(([r]) => [r.population_density!, r.incident_rate!] as [number, number]) } });
        rows = [...rows];
        need.forEach(([r, i], k) => (rows[i] = { ...r, risk_level: res.labels[k] ?? null, risk_source: "model" }));
      }
      const payload = {
        name: name.trim().slice(0, 120) || parsed.file.name,
        source_label: source.trim().slice(0, 200) || "User upload (unverified)",
        row_count: rows.length,
        columns: parsed.report.recognized as unknown as Json,
        rows: rows as unknown as Json,
        summary: { ...summarize(rows), report: { ...parsed.report, typeErrors: parsed.report.typeErrors.slice(0, 50) }, fileName: parsed.file.name, modelLabelled: need.length } as unknown as Json,
        updated_at: new Date().toISOString(),
      };
      if (replaceId) {
        const { error } = await supabase.from("datasets").update({ ...payload, is_verified: false }).eq("id", replaceId);
        if (error) throw error;
        return replaceId;
      }
      const { data, error } = await supabase.from("datasets").insert({ ...payload, user_id: u.user.id }).select("id").single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      toast.success(replaceId ? "Dataset replaced" : "Dataset saved");
      qc.invalidateQueries({ queryKey: datasetsQueryKey });
      qc.invalidateQueries({ queryKey: ["dataset-rows", id] });
      setParsed(null); setName(""); setSource(""); setReplaceId(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("datasets").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      toast.success("Dataset removed");
      if (selectedId === id) setSelectedId("synthetic");
      qc.invalidateQueries({ queryKey: datasetsQueryKey });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const r = parsed?.report;
  return (
    <>
      <PageHeader title="Dataset management" description="Uploads are checked on your device, then saved privately to your account. They stay unverified until an administrator verifies them." />

      <SectionCard
        title={replaceId ? "Replace dataset" : "Upload CSV"}
        description={<>Required column: <code>area</code>. Optional: {Object.keys(KNOWN_COLUMNS).filter((k) => k !== "area").map((k) => <code key={k} className="mr-1">{k}</code>)}. Max 5 MB.</>}
        action={replaceId && <Button variant="ghost" size="sm" onClick={() => setReplaceId(null)}>Cancel replace</Button>}
      >
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
        >
          {parsing ? <Loader2 className="size-6 animate-spin" /> : <FileUp className="size-6 text-primary" />}
          <span>Drop a CSV here or <span className="text-primary">browse</span></span>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>

        {parsed && r && (
          <div className="mt-5 space-y-4 animate-fade-up">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Rows in file", r.totalRows],
                ["Valid rows", r.validRows],
                ["Duplicates removed", r.duplicates],
                ["Type errors", r.typeErrors.length],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="font-mono text-lg">{v}</p></div>
              ))}
            </div>
            <div className="space-y-1 text-sm">
              {r.missingRequired.length ? (
                <p className="flex items-center gap-2 text-destructive"><XCircle className="size-4" /> Missing required column: {r.missingRequired.join(", ")}</p>
              ) : (
                <p className="flex items-center gap-2 text-risk-low"><CheckCircle2 className="size-4" /> Recognised columns: {r.recognized.join(", ")}</p>
              )}
              {r.ignored.length > 0 && <p className="text-muted-foreground">Ignored columns: {r.ignored.join(", ")}</p>}
              {Object.keys(r.missingValues).length > 0 && (
                <p className="text-muted-foreground">Missing values: {Object.entries(r.missingValues).map(([k, v]) => `${k} (${v})`).join(", ")}</p>
              )}
              {r.typeErrors.slice(0, 5).map((t, i) => (
                <p key={i} className="text-risk-moderate">Row {t.row}: “{t.value}” is not a valid {t.column}</p>
              ))}
              {r.typeErrors.length > 5 && <p className="text-muted-foreground">…and {r.typeErrors.length - 5} more type errors (those values are left blank).</p>}
              {!parsed.rows.some((x) => x.risk_level) && parsed.rows.some((x) => x.population_density != null && x.incident_rate != null) && (
                <p className="text-cyan">No risk_level column. Risk classes will be estimated by the model and marked as model-generated.</p>
              )}
            </div>

            {parsed.rows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[600px] text-xs">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>{r.recognized.map((c) => <th key={c} className="px-3 py-2">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 8).map((row, i) => (
                      <tr key={i} className="border-t">
                        {r.recognized.map((c) => (
                          <td key={c} className="px-3 py-1.5 font-mono">
                            {c === "risk_level" ? <RiskBadge level={row.risk_level} /> : String((row as unknown as Record<string, unknown>)[c] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">Preview of the first {Math.min(8, parsed.rows.length)} of {parsed.rows.length} rows</p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="ds-name">Dataset name</Label><Input id="ds-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="ds-src">Source / provenance</Label><Input id="ds-src" placeholder="e.g. City open data portal, 2024 export" value={source} maxLength={200} onChange={(e) => setSource(e.target.value)} /></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending || !!r.missingRequired.length || !parsed.rows.length}>
                {save.isPending && <Loader2 className="animate-spin" />} {replaceId ? "Replace dataset" : "Save dataset"}
              </Button>
              <Button variant="ghost" onClick={() => { setParsed(null); if (fileRef.current) fileRef.current.value = ""; }}>Discard</Button>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Your datasets" className="mt-4">
        <ul className="divide-y">
          <li className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium">Built-in synthetic training set</p>
              <p className="text-xs text-muted-foreground">240 records · generated · used to train the model</p>
            </div>
            <div className="flex items-center gap-2">
              <DemoBadge />
              <Button size="sm" variant={selectedId === "synthetic" ? "secondary" : "outline"} onClick={() => setSelectedId("synthetic")}>
                {selectedId === "synthetic" ? "Active" : "Use"}
              </Button>
            </div>
          </li>
          {datasets.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d.row_count} rows · {d.source_label} · uploaded {new Date(d.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                {d.is_verified ? <span className="rounded-full bg-risk-low/15 px-2 py-0.5 text-xs text-risk-low">Verified</span> : <DemoBadge>Unverified</DemoBadge>}
                <Button size="sm" variant={selectedId === d.id ? "secondary" : "outline"} onClick={() => setSelectedId(d.id)}>
                  {selectedId === d.id ? "Active" : "Use"}
                </Button>
                <Button size="icon" variant="ghost" aria-label="Replace dataset" onClick={() => { setReplaceId(d.id); setName(d.name); fileRef.current?.click(); }}>
                  <RefreshCw />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Delete dataset" onClick={() => setDeleteId(d.id)}><Trash2 /></Button>
              </div>
            </li>
          ))}
        </ul>
        {!datasets.length && <EmptyState title="No uploads yet">Upload a CSV above to analyse your own data.</EmptyState>}
      </SectionCard>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this dataset?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the dataset and its records. It can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && del.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
