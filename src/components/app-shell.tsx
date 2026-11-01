import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  BrainCircuit,
  Database,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Siren,
  UserRound,
  BookOpen,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/brand";
import { DatasetPicker } from "@/components/dataset-picker";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/map", label: "Risk map", icon: MapIcon },
  { to: "/predict", label: "AI prediction", icon: BrainCircuit },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/datasets", label: "Datasets", icon: Database },
  { to: "/sos", label: "SOS demo", icon: Siren },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => {
        const active = path === n.to;
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <n.icon className={cn("size-4", active && "text-primary")} />
            {n.label}
          </Link>
        );
      })}
      <Link
        to="/methodology"
        onClick={onNavigate}
        className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
      >
        <BookOpen className="size-4" />
        Methodology
      </Link>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else navigate({ to: "/" });
  };
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar p-4 lg:flex">
        <Logo className="mb-8 px-2" />
        <NavLinks />
        <Button variant="ghost" className="mt-auto justify-start text-muted-foreground" onClick={signOut}>
          <LogOut /> Sign out
        </Button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[1001] flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col bg-sidebar p-4">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Logo className="mb-6 px-2" />
              <NavLinks onNavigate={() => setOpen(false)} />
              <Button variant="ghost" className="mt-auto justify-start" onClick={signOut}>
                <LogOut /> Sign out
              </Button>
            </SheetContent>
          </Sheet>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">Dataset</span>
            <DatasetPicker />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8 animate-fade-up">{children}</main>
      </div>
    </div>
  );
}
