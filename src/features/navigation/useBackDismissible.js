import { useEffect, useRef } from 'react';

export default function useBackDismissible({
  id,
  open,
  onDismiss,
  priority = 0,
  blocking = false,
  registerBackDismissible,
}) {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!open || typeof registerBackDismissible !== 'function' || typeof onDismissRef.current !== 'function') {
      return undefined;
    }

    return registerBackDismissible({
      id,
      onDismiss: () => onDismissRef.current?.(),
      priority,
      blocking,
    });
  }, [blocking, id, open, priority, registerBackDismissible]);
}
