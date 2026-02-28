import { createClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import AdminPanel from "./AdminPanel";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/dashboard");

  const [{ data: episodes }, { data: questions }] = await Promise.all([
    supabase.from("episodes").select("*").order("episode_number", { ascending: false }),
    supabase
      .from("questions")
      .select("id, episode_id, question_text, point_value, correct_answer, lock_time, episodes(episode_number)")
      .order("id", { ascending: false }),
  ]);

  return <AdminPanel episodes={episodes ?? []} questions={questions ?? []} />;
}
