import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/75 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Logo />
        <nav className="ml-auto hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="/#capabilities" className="hover:text-foreground">Capabilities</a>
          <a href="/#how-it-works" className="hover:text-foreground">How it works</a>
          <Link to="/methodology" className="hover:text-foreground">Methodology</Link>
        </nav>
        <Button asChild size="sm" className="ml-auto md:ml-0">
          <Link to="/dashboard">Open app</Link>
        </Button>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            An academic project that explores area-level risk classification. It is not an emergency service.
          </p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-medium">Product</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><Link to="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
            <li><Link to="/predict" className="hover:text-foreground">AI prediction</Link></li>
            <li><Link to="/map" className="hover:text-foreground">Risk map</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-medium">Project</p>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><Link to="/methodology" className="hover:text-foreground">Methodology & limitations</Link></li>
            <li><a href="/api/public/health" className="hover:text-foreground">API health</a></li>
          </ul>
        </div>
      </div>
      <p className="border-t py-4 text-center text-xs text-muted-foreground">
        SafeRoute AI · In an emergency, contact your local emergency number directly.
      </p>
    </footer>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
