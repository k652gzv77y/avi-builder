export default function WelcomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Avi Builder</p>
      <h1 className="text-sm font-medium text-foreground">
        Connect Supabase to open the canvas
      </h1>
      <p className="max-w-sm text-xs leading-5 text-muted-foreground">
        Add your Supabase URL and keys to
        {' '}
        <code className="rounded bg-secondary px-1 py-0.5 text-[11px]">.env.local</code>
        , then restart the dev server and reopen the project.
      </p>
    </main>
  );
}
