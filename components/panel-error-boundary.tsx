'use client';

import React from 'react';

interface PanelErrorBoundaryProps {
  children: React.ReactNode;
  /** Short name shown if this panel throws, so the rest of the editor stays up. */
  label: string;
}

interface PanelErrorBoundaryState {
  error: (Error & { digest?: string }) | null;
}

/**
 * Keeps a failure inside one editor panel.
 * The page-level builder error screen replaces the canvas, layers, and
 * sidebars together, so a hidden panel (CMS, insert library) must not be
 * allowed to do that.
 */
export class PanelErrorBoundary extends React.Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  state: PanelErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error & { digest?: string }): PanelErrorBoundaryState {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const detail = [error.message, error.digest].filter(Boolean).join('\n');

    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center p-4">
        <div className="max-w-sm text-center">
          <p className="text-xs font-medium">
            {this.props.label} could not be drawn
          </p>
          {detail ? (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-left font-mono text-[10px] text-muted-foreground">
              {detail}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }
}
