import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Angemeldet als {data.user?.email}. Die App-Shell mit Navigation folgt in
        Milestone 1.
      </p>
    </main>
  );
}
