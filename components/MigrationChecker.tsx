'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import BuilderLoading from '@/components/BuilderLoading';
import { interpretMigrationResponse } from '@/lib/migration-response';
import { projectsPath } from '@/lib/project-url';

interface MigrationCheckerProps {
  onComplete: () => void;
}

export default function MigrationChecker({ onComplete }: MigrationCheckerProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [progress, setProgress] = useState('Checking database status...');
  const [error, setError] = useState<string | null>(null);
  const hasRunRef = useRef(false);

  const checkAndRunMigrations = useCallback(async () => {
    try {
      setIsChecking(true);
      setProgress('Checking and running migrations...');
      setError(null);

      const response = await fetch(projectsPath('/api/setup/migrate'), {
        method: 'POST',
      });
      const raw = await response.text();
      const outcome = interpretMigrationResponse(response.status, raw);

      if (!outcome.proceed) {
        console.error('Migration request failed', outcome.error);
        setError(outcome.error || 'Migration failed');
        setIsChecking(false);
        return;
      }

      onComplete();
    } catch (err) {
      console.error('Failed to run migrations:', err);
      setError(err instanceof Error ? err.message : 'Migration failed');
      setIsChecking(false);
    }
  }, [onComplete]);

  useEffect(() => {
    if (hasRunRef.current) {
      return;
    }
    hasRunRef.current = true;
    checkAndRunMigrations();
  }, [checkAndRunMigrations]);

  const handleRetry = () => {
    setError(null);
    checkAndRunMigrations();
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!isChecking && !error) {
    return null;
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] bg-background text-foreground flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="flex-1 flex items-center text-center flex-col gap-1">
            <Label size="sm">
              Migration failed
            </Label>
            <Label variant="muted" size="sm">
              {error}
            </Label>
            <div className="w-full max-w-xs grid grid-cols-2 gap-3 mt-2">
              <Button onClick={handleRetry}>
                Retry migration
              </Button>
              <Button
                variant="secondary"
                onClick={handleSkip}
              >
                <span>Skip</span>
                <span className="text-[10px] opacity-60">Not recommended</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <BuilderLoading message={progress} />;
}
