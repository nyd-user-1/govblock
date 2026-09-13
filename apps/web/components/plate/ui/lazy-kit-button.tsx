'use client';

import * as React from 'react';
import { useEditorRef } from 'platejs/react';

import { useLazyKits, type LazyKit } from '@/lib/typeset/lazy-kits';
import { cn } from '@govblock/ui/lib/utils';

import { ToolbarButton } from './toolbar';

// A toolbar button whose kit may not be in the editor yet (Brendan,
// 2026-09-13): the button is always drawn. With the kit present it is the
// real button. Without it, a stand-in with the same face: hover fetches the
// kit's code, a click adds the kit to the editor and, once the real button
// has taken its place, presses it, so the feature opens from that first
// click. Where there is no way to add kits (the template's editor, the
// disabled toolbar on Git and Diff) the stand-in is inert.

type Props = {
  kit: LazyKit;
  /** The plugin key the real button needs in the editor. */
  pluginKey: string;
  /** The real button. */
  children: React.ReactNode;
  /** The stand-in's face; the same icon the real button wears. */
  icon?: React.ReactNode;
  tooltip?: string;
  isDropdown?: boolean;
  /** A stand-in of its own shape, for buttons that are not one button. */
  placeholder?: (props: { onPointerEnter: () => void; onClick: () => void; pending: boolean }) => React.ReactNode;
  /** Press the real button once it arrives (off for controls where a press would edit). */
  open?: boolean;
};

export function LazyKitButton({ kit, pluginKey, children, icon, tooltip, isDropdown, placeholder, open = true }: Props) {
  const editor = useEditorRef();
  const kits = useLazyKits();
  const has = pluginKey in editor.plugins;
  const [pending, setPending] = React.useState(false);
  const host = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!has || !pending) return;
    setPending(false);
    if (!open) return;
    const button = host.current?.querySelector('button');
    if (!button) return;
    button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
    button.click();
  }, [has, pending, open]);

  if (has) {
    return (
      <span ref={host} className="contents">
        {children}
      </span>
    );
  }

  const onPointerEnter = () => kits?.preload(kit);
  const onClick = () => {
    if (!kits) return;
    setPending(true);
    void kits.enable(kit);
  };

  if (placeholder) return <>{placeholder({ onPointerEnter, onClick, pending })}</>;

  return (
    <ToolbarButton
      tooltip={tooltip}
      isDropdown={isDropdown}
      disabled={!kits}
      className={cn(pending && 'animate-pulse')}
      onPointerEnter={onPointerEnter}
      onFocus={onPointerEnter}
      onClick={onClick}
    >
      {icon}
    </ToolbarButton>
  );
}
