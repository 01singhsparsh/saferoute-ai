import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSyntheticDataset } from "@/lib/ml.functions";
import type { DataRow } from "@/lib/dataset";

export type DatasetMeta = {
  id: string;
  name: string;
  source_label: string;
  is_verified: boolean;
  row_count: number;
  created_at: string;
  updated_at: string;
};

export type ActiveDataset = {
  id: "synthetic" | string;
  name: string;
  isSynthetic: boolean;
  isVerified: boolean;
  sourceLabel: string;
  updatedAt: string | null;
  rows: DataRow[];
};

type Ctx = {
  selectedId: string;
  setSelectedId: (id: string) => void;
  datasets: DatasetMeta[];
  active: ActiveDataset | null;
  isLoading: boolean;
  error: Error | null;
};

const DatasetContext = createContext<Ctx | null>(null);
const KEY = "saferoute.activeDataset";

export const datasetsQueryKey = ["datasets"] as const;

export function useDatasetList() {
  return useQuery({
    queryKey: datasetsQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("datasets")
        .select("id,name,source_label,is_verified,row_count,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DatasetMeta[];
    },
  });
}

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelected] = useState("synthetic");
  useEffect(() => {
    const v = localStorage.getItem(KEY);
    if (v) setSelected(v);
  }, []);
  const setSelectedId = (id: string) => {
    localStorage.setItem(KEY, id);
    setSelected(id);
  };

  const list = useDatasetList();
  const synthetic = useQuery({
    queryKey: ["synthetic-dataset"],
    queryFn: () => getSyntheticDataset(),
    staleTime: Infinity,
  });
  const exists = selectedId === "synthetic" || list.data?.some((d) => d.id === selectedId);
  const effectiveId = list.data && !exists ? "synthetic" : selectedId;

  const uploaded = useQuery({
    queryKey: ["dataset-rows", effectiveId],
    enabled: effectiveId !== "synthetic",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("datasets")
        .select("id,name,source_label,is_verified,updated_at,rows")
        .eq("id", effectiveId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const active = useMemo<ActiveDataset | null>(() => {
    if (effectiveId === "synthetic") {
      if (!synthetic.data) return null;
      return {
        id: "synthetic",
        name: "Built-in synthetic training set",
        isSynthetic: true,
        isVerified: false,
        sourceLabel: "Synthetic (generated for model demonstration)",
        updatedAt: null,
        rows: synthetic.data.map((r) => ({ ...r, risk_source: "dataset" as const })),
      };
    }
    if (!uploaded.data) return null;
    return {
      id: uploaded.data.id,
      name: uploaded.data.name,
      isSynthetic: false,
      isVerified: uploaded.data.is_verified,
      sourceLabel: uploaded.data.source_label,
      updatedAt: uploaded.data.updated_at,
      rows: (uploaded.data.rows as unknown as DataRow[]) ?? [],
    };
  }, [effectiveId, synthetic.data, uploaded.data]);

  const value: Ctx = {
    selectedId: effectiveId,
    setSelectedId,
    datasets: list.data ?? [],
    active,
    isLoading: effectiveId === "synthetic" ? synthetic.isLoading : uploaded.isLoading,
    error: (synthetic.error ?? uploaded.error ?? list.error) as Error | null,
  };
  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>;
}

export function useActiveDataset() {
  const c = useContext(DatasetContext);
  if (!c) throw new Error("useActiveDataset must be used inside DatasetProvider");
  return c;
}
