import { createClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ user: null, userError: userError?.message });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, is_admin")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    profile,
    profileError: profileError?.message,
  });
}
