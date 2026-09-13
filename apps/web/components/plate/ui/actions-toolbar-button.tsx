'use client';

import { GitCommitHorizontalIcon } from 'lucide-react';

import { useActionsPanel } from '@/lib/typeset/actions-panel';

import { ToolbarButton } from './toolbar';

// The bill's actions, beside Comment (Brendan, 2026-09-13): opens the aside
// that lists what the legislature did to the bill, each action a commit.
export function ActionsToolbarButton() {
  const panel = useActionsPanel();

  return (
    <ToolbarButton
      data-plate-prevent-overlay
      pressed={!!panel?.open}
      disabled={!panel?.bill}
      onClick={() => panel?.toggle()}
      tooltip="Actions"
    >
      <GitCommitHorizontalIcon />
    </ToolbarButton>
  );
}
