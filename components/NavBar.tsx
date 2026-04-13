"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, Users, Trophy } from "lucide-react";

const LINKS = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/awards", label: "Awards", icon: Trophy },
  { href: "/analyst", label: "AI Analyst", icon: Bot },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg-card)]/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center">
            <span className="text-black font-black text-xs">HNA</span>
          </div>
          <span className="font-bold text-base text-[var(--text)] hidden sm:block">
            Hockey Night Analytics
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/" && pathname.startsWith(href)) ||
              (href === "/teams" && pathname.startsWith("/team/"));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-[var(--accent)] text-black"
                    : "text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-elevated)]"
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
