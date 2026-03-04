"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Flame, Home, ScrollText, Trophy, Settings2, type LucideIcon } from "lucide-react";

const baseNavItems: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Home", Icon: Home },
  { href: "/predictions", label: "Predictions", Icon: ScrollText },
  { href: "/leaderboard", label: "Leaderboard", Icon: Trophy },
];

export default function NavBar({
  username,
  isAdmin,
}: {
  username: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const items = isAdmin
    ? [...baseNavItems, { href: "/admin", label: "Admin", Icon: Settings2 }]
    : baseNavItems;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col border-r border-white/10 bg-earth-surface py-6 px-4 z-10">
        <div className="mb-8 px-3 flex items-center gap-2 text-survivor-green">
          <Flame className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-display text-2xl uppercase tracking-widest leading-none">Survivor</p>
            <p className="text-xs text-parchment/40 font-medium uppercase tracking-widest mt-0.5">Predictions</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  active
                    ? "bg-survivor-green/15 text-survivor-green"
                    : "text-parchment/60 hover:bg-white/5 hover:text-parchment"
                }`}
              >
                <item.Icon className="w-4 h-4 shrink-0" />
                <span className="font-display text-xs uppercase tracking-widest">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 pt-4 px-1">
          <p className="text-xs text-parchment/40 mb-0.5">Signed in as</p>
          <p className="text-sm font-semibold text-parchment truncate mb-3">{username}</p>
          <button
            onClick={handleLogout}
            className="text-sm text-parchment/40 hover:text-parchment transition-colors"
          >
            Log out →
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 bg-earth-surface border-t border-white/10 flex">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 transition-colors ${
                active ? "text-survivor-green" : "text-parchment/40"
              }`}
            >
              <item.Icon className="w-5 h-5" />
              <span className="font-display text-[10px] uppercase tracking-widest leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
