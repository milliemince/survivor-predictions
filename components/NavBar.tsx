"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/predictions", label: "Predictions", icon: "🗳️" },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
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
    ? [...baseNavItems, { href: "/admin", label: "Admin", icon: "⚙️" }]
    : baseNavItems;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col border-r border-black/10 bg-white py-6 px-4 z-10">
        <div className="mb-8 px-3">
          <p className="text-xl font-bold tracking-tight">🔥 Survivor</p>
          <p className="text-xs text-zinc-400 font-medium uppercase tracking-widest mt-0.5">Predictions</p>
        </div>

        <nav className="flex-1 space-y-1">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-orange-50 text-orange-700"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-black/10 pt-4 px-1">
          <p className="text-xs text-zinc-400 mb-0.5">Signed in as</p>
          <p className="text-sm font-semibold text-zinc-800 truncate mb-3">{username}</p>
          <button
            onClick={handleLogout}
            className="text-sm text-zinc-400 hover:text-zinc-900 transition-colors"
          >
            Log out →
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-black/10 flex">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                active ? "text-orange-600" : "text-zinc-400"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
