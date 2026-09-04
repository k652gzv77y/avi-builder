import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { data: projects, error } = await admin
    .from('builder_projects')
    .select('id, slug, name, status, database_mode, supabase_project_ref, supabase_project_name, supabase_project_url, updated_at')
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (projects || []).map((p) => p.id);
  const { data: domains } = ids.length
    ? await admin
        .from('builder_project_domains')
        .select('project_id, hostname, status, is_primary')
        .in('project_id', ids)
    : { data: [] as Array<{ project_id: string; hostname: string; status: string; is_primary: boolean }> };

  const byProject = new Map<string, typeof domains>();
  for (const d of domains || []) {
    const list = byProject.get(d.project_id) || [];
    list.push(d);
    byProject.set(d.project_id, list);
  }

  return NextResponse.json({
    projects: (projects || []).map((p) => ({
      ...p,
      domains: byProject.get(p.id) || [],
    })),
  });
}
