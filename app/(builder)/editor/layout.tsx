import { headers } from 'next/headers';
import BuilderLayoutClient from './BuilderLayoutClient';
import { PROJECT_SLUG_HEADER } from '@/lib/project-url';

/**
 * Avi Builder Editor Layout (Server Component)
 *
 * Proxy rewrites /projects/:slug → /editor and sets x-avi-project-slug.
 * Pass that slug into the client shell so projectsPath() works during SSR.
 */

export const dynamic = 'force-dynamic';

export default async function BuilderLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const initialSlug = headerList.get(PROJECT_SLUG_HEADER);
  return <BuilderLayoutClient initialSlug={initialSlug}>{children}</BuilderLayoutClient>;
}
