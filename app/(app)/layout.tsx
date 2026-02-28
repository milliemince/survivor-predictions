import { createClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, is_admin")
    .eq("id", user.id)
    .single();

  const username = profile?.username ?? user.email ?? "Player";
  const isAdmin = profile?.is_admin ?? false;

  return (
    <div className="min-h-screen bg-zinc-50">
      <NavBar username={username} isAdmin={isAdmin} />
      <main className="md:pl-64 pb-20 md:pb-0">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
