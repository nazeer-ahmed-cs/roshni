export default function SupabaseNotice() {
  return (
    <div className="rounded-xl border border-dashed border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-100">
      <p className="font-semibold text-amber-300">Supabase not configured yet</p>
      <ol className="mt-2 list-decimal space-y-1 pl-4 text-neutral-300">
        <li>Create a free project at supabase.com</li>
        <li>
          Run the SQL from <code className="rounded bg-black/30 px-1">supabase/schema.sql</code> in
          the SQL editor
        </li>
        <li>
          Copy <code className="rounded bg-black/30 px-1">.env.example</code> →{" "}
          <code className="rounded bg-black/30 px-1">.env.local</code> and paste your URL + anon key
        </li>
        <li>Restart <code className="rounded bg-black/30 px-1">npm run dev</code></li>
      </ol>
    </div>
  );
}
