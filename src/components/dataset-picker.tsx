import { Database } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveDataset } from "@/hooks/use-active-dataset";
import { DemoBadge } from "@/components/brand";

export function DatasetPicker() {
  const { selectedId, setSelectedId, datasets } = useActiveDataset();
  return (
    <Select value={selectedId} onValueChange={setSelectedId}>
      <SelectTrigger className="h-9 w-[220px] sm:w-[260px]" aria-label="Active dataset">
        <Database className="size-4 text-primary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="synthetic">Synthetic training set (demo)</SelectItem>
        {datasets.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name} {d.is_verified ? "· verified" : "· unverified"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DataSourceNotice() {
  const { active } = useActiveDataset();
  if (!active) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border bg-surface/60 px-3 py-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Data source:</span>
      {active.name}
      {active.isSynthetic ? (
        <DemoBadge />
      ) : active.isVerified ? (
        <span className="rounded-full bg-risk-low/15 px-2 py-0.5 text-risk-low">Verified</span>
      ) : (
        <DemoBadge>Unverified upload — not official data</DemoBadge>
      )}
    </div>
  );
}
