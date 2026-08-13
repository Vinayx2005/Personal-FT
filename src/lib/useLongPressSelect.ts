'use client';

import { useEffect, useRef, type PointerEvent, type MouseEvent } from 'react';

// Shared long-press-to-select handler factory used by the mobile list rows
// on Expenses / Income / Investments etc. Give it two callbacks — one that
// runs after a 500 ms press (usually flip the row into selection mode) and
// one that runs on a normal tap — and it returns a props bundle you spread
// onto the row element:
//
//   const longPress = useLongPressSelect();
//   ...
//   <li {...longPress.getHandlers(() => selectRow(id), () => openDetail(id))}>
//
// Guards against:
//   - Scrolling: a > 10 px move cancels the timer so the list still scrolls
//   - Double-fire: the synthetic click after a long-press is swallowed so
//     the tap handler doesn't ALSO run (which would open a detail modal
//     the user didn't ask for)
//   - Missed cleanup: pending timer is cleared on component unmount
//
// One hook instance per component covers every row; refs are shared but
// only one finger can be down at a time on touch, so there's no conflict.
export function useLongPressSelect() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const LONG_PRESS_MS = 500;
  const MOVE_TOLERANCE_PX = 10;

  const cancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => () => cancel(), []);

  const getHandlers = (onLongPress: () => void, onTap: () => void) => ({
    onPointerDown: (e: PointerEvent) => {
      startPosRef.current = { x: e.clientX, y: e.clientY };
      firedRef.current = false;
      cancel();
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        timerRef.current = null;
        onLongPress();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(30); } catch { /* not supported here */ }
        }
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent) => {
      const dx = Math.abs(e.clientX - startPosRef.current.x);
      const dy = Math.abs(e.clientY - startPosRef.current.y);
      if (dx > MOVE_TOLERANCE_PX || dy > MOVE_TOLERANCE_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClick: () => {
      // Swallow the synthetic click that fires immediately after a
      // long-press — otherwise the tap-to-open handler would ALSO run.
      if (firedRef.current) {
        firedRef.current = false;
        return;
      }
      onTap();
    },
    // Suppress the browser's own long-press context menu (image save prompt,
    // text-selection popover) so our select-mode gesture is the only one.
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  });

  return { getHandlers };
}
