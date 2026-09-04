'use client';

import React, { useEffect } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgentSettingsStore } from '@/stores/useAgentSettingsStore';
import { useAiChatStore } from '@/stores/useAiChatStore';

import AiChatPanel from './ai/AiChatPanel';
import RightSidebar from './RightSidebar';

import type { Layer } from '@/types';

interface RightPanelProps {
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

/**
 * Right-hand column shell hosting the top-level Human / Agent switch.
 * "Human" surfaces the manual property editor (Design / Settings /
 * Interactions) that lives in RightSidebar; "Agent" surfaces the AI chat.
 *
 * When the agent is turned off in Settings → Agent, the switch is hidden
 * entirely and only the manual editor is rendered.
 */
export default function RightPanel({ onLayerUpdate }: RightPanelProps) {
  const isAgent = useAiChatStore((state) => state.isOpen);
  const open = useAiChatStore((state) => state.open);
  const close = useAiChatStore((state) => state.close);
  const agentEnabled = useAgentSettingsStore((state) => state.status?.agentEnabled ?? true);
  const loadStatus = useAgentSettingsStore((state) => state.loadStatus);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleModeChange = (value: string) => {
    if (value === 'agent') {
      open();
    } else {
      close();
    }
  };

  if (!agentEnabled) {
    return <RightSidebar onLayerUpdate={onLayerUpdate} />;
  }

  return (
    <div className="flex h-full w-[260px] shrink-0 flex-col overflow-hidden border-l bg-background">
      <div className="shrink-0 px-2 pt-2">
        <Tabs value={isAgent ? 'agent' : 'human'} onValueChange={handleModeChange}>
          <TabsList className="h-7 w-full">
            <TabsTrigger value="human" className="flex-1 text-[11px]">Design</TabsTrigger>
            <TabsTrigger value="agent" className="flex-1 text-[11px]">Agent</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {isAgent ? (
          <AiChatPanel embedded />
        ) : (
          <RightSidebar embedded onLayerUpdate={onLayerUpdate} />
        )}
      </div>
    </div>
  );
}
