import { headers } from 'next/headers';

import ProjectSpace from '@/components/workspace/project-space';
import { PROJECT_SLUG_HEADER } from '@/lib/project-url';

export const dynamic = 'force-dynamic';

export default async function ProjectSpacePage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const headerList = await headers();
  const params = await searchParams;
  const slug = headerList.get(PROJECT_SLUG_HEADER) ?? '';
  return <ProjectSpace slug={slug} initialBranch={params.branch ?? null} />;
}
