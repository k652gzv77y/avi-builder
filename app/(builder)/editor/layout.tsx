import BuilderLayoutClient from './BuilderLayoutClient';

/**
 * Avi Builder Editor Layout (Server Component)
 * 
 * Forces dynamic rendering for all /ycode/* routes.
 * This is required because:
 * 1. Editor routes require authentication (user-specific)
 * 2. Client components use useSearchParams which needs dynamic context
 */

// Force all /ycode routes to be dynamic - no static prerendering
// This prevents useSearchParams errors during build
export const dynamic = 'force-dynamic';

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <BuilderLayoutClient>{children}</BuilderLayoutClient>;
}
