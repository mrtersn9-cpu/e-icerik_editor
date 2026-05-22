import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';

import { isValidWidgetMessage, WIDGET_MESSAGE_TYPES } from './widgetProtocol';

const WidgetHost = forwardRef(function WidgetHost(
  { src, widgetInstanceId, onEvent, onReady, onError, style },
  ref
) {
  const iframeRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const queueRef = useRef([]);

  const flushQueue = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    while (queueRef.current.length) {
      const msg = queueRef.current.shift();
      try {
        win.postMessage(msg, '*');
      } catch {
        // ignore postMessage errors
      }
    }
  }, []);

  const sendCommand = useCallback(
    (command, payload) => {
      const msg = {
        type: WIDGET_MESSAGE_TYPES.COMMAND,
        widgetInstanceId,
        command,
        payload: payload || {},
      };
      if (!isReady) {
        queueRef.current.push(msg);
        return;
      }
      const win = iframeRef.current?.contentWindow;
      if (win) {
        try {
          win.postMessage(msg, '*');
        } catch {
          // ignore
        }
      }
    },
    [widgetInstanceId, isReady]
  );

  useImperativeHandle(ref, () => ({ sendCommand }), [sendCommand]);

  useEffect(() => {
    function handleMessage(event) {
      if (!iframeRef.current) return;
      if (event.source !== iframeRef.current.contentWindow) return;
      if (!isValidWidgetMessage(event.data)) return;
      if (event.data.widgetInstanceId !== widgetInstanceId) return;

      switch (event.data.type) {
        case WIDGET_MESSAGE_TYPES.READY:
          setIsReady(true);
          flushQueue();
          onReady?.();
          break;
        case WIDGET_MESSAGE_TYPES.EVENT:
          onEvent?.(event.data.payload?.eventName, event.data.payload?.payload);
          break;
        case WIDGET_MESSAGE_TYPES.ERROR:
          onError?.(event.data.payload);
          break;
        case WIDGET_MESSAGE_TYPES.COMPLETE:
          onEvent?.('__complete__', event.data.payload);
          break;
        default:
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [widgetInstanceId, onEvent, onReady, onError, flushQueue]);

  useEffect(() => {
    setIsReady(false);
    queueRef.current = [];
  }, [src]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title={`widget-${widgetInstanceId}`}
      sandbox="allow-scripts allow-forms allow-presentation"
      style={{ width: '100%', height: '100%', border: 'none', ...style }}
    />
  );
});

export default WidgetHost;
