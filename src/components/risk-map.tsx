import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DataRow } from "@/lib/dataset";

const COLORS = { Low: "#3fc77a", Moderate: "#e9b63f", High: "#e5533d" } as const;

export type MapPoint = DataRow & { latitude: number; longitude: number; _i: number };

export default function RiskMap({
  points,
  focus,
  onSelect,
}: {
  points: MapPoint[];
  focus: { lat: number; lng: number; zoom?: number; bbox?: [number, number, number, number] } | null;
  onSelect: (p: MapPoint) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true, worldCopyJump: true }).setView([20, 0], 2);
    const cartoKey = import.meta.env["VITE_CARTO_API_KEY"];
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${cartoKey ? `?key=${cartoKey}` : ""}`, {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    points.forEach((p) => {
      const c = p.risk_level ? COLORS[p.risk_level] : "#8892a6";
      L.circleMarker([p.latitude, p.longitude], { radius: 7, color: c, fillColor: c, fillOpacity: 0.55, weight: 1.5 })
        .bindTooltip(`${p.area}${p.risk_level ? ` · ${p.risk_level}` : ""}`)
        .on("click", () => selectRef.current(p))
        .addTo(g);
    });
    if (points.length) m.fitBounds(L.latLngBounds(points.map((p) => [p.latitude, p.longitude])), { padding: [40, 40], maxZoom: 14 });
  }, [points]);

  useEffect(() => {
    if (!focus || !map.current) return;
    if (focus.bbox) {
      const [s, n, w, e] = focus.bbox;
      map.current.fitBounds([[s, w], [n, e]]);
    } else map.current.setView([focus.lat, focus.lng], focus.zoom ?? 13);
  }, [focus]);

  return <div ref={el} className="h-full w-full" />;
}
