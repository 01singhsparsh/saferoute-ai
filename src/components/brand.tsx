import { Link } from "@tanstack/react-router";
import { FlaskConical, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Label } from "@/lib/ml/random-forest";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2 font-display font-semibold", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
        <ShieldCheck className="size-4" />
      </span>
      <span>
        SafeRoute <span className="text-cyan">AI</span>
      </span>
    </Link>
  );
}

const riskClass: Record<Label, string> = {
  Low: "bg-risk-low/15 text-risk-low ring-risk-low/30",
  Moderate: "bg-risk-moderate/15 text-risk-moderate ring-risk-moderate/30",
  High: "bg-risk-high/15 text-risk-high ring-risk-high/30",
};
export const riskColorVar: Record<Label, string> = {
  Low: "var(--risk-low)",
  Moderate: "var(--risk-moderate)",
  High: "var(--risk-high)",
};

export function RiskBadge({ level, className }: { level: Label | null | undefined; className?: string }) {
  if (!level)
    return <span className={cn("rounded-full px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border", className)}>Unlabelled</span>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1", riskClass[level], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {level} risk
    </span>
  );
}

export function DemoBadge({ children = "Synthetic demo data" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-demo px-2.5 py-0.5 text-xs font-medium text-demo-foreground ring-1 ring-risk-moderate/30">
      <FlaskConical className="size-3" />
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("glass rounded-xl p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h3 className="text-base font-semibold">{title}</h3>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        {label}
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center">
      {icon && <div className="mb-3 text-muted-foreground">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      </div>
      {action}
    </div>
  );
}
