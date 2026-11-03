'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

interface BuilderErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Editor shell error boundary.
 *
 * A render failure here used to reuse the published site error page
 * (`/api/error-page?code=500&published=true`). That painted the site's
 * "500 Server error" screen over the builder even when every API returned 200.
 * The editor keeps its own recovery UI instead.
 */
export default function BuilderError({ error, reset }: BuilderErrorProps) {
  useEffect(() => {
    console.error('[Editor] render error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-sm font-medium">
          The editor could not open this page
        </h1>
        <p className="mt-2 text-xs text-muted-foreground">
          The builder hit an unexpected error while drawing the canvas. Your published site was not changed.
        </p>
        <Button
          type="button"
          size="sm"
          className="mt-6"
          onClick={reset}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
