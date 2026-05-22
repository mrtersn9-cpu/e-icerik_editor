(function(global) {
  'use strict';

  const PROTOCOL = {
    EVENT: 'EICERIK_WIDGET_EVENT',
    COMMAND: 'EICERIK_WIDGET_COMMAND',
    READY: 'EICERIK_WIDGET_READY',
    ERROR: 'EICERIK_WIDGET_ERROR',
    COMPLETE: 'EICERIK_WIDGET_COMPLETE',
    PROPS: 'EICERIK_WIDGET_PROPS',
  };

  function getWidgetInstanceId() {
    try {
      const params = new URLSearchParams(global.location.search);
      return params.get('instanceId') || '';
    } catch {
      return '';
    }
  }

  const instanceId = getWidgetInstanceId();
  const commandHandlers = new Map();
  let propsCache = null;
  let readySent = false;

  function postMessage(type, payload) {
    if (!global.parent || global.parent === global) return;
    global.parent.postMessage(
      {
        type,
        widgetInstanceId: instanceId,
        ...(payload ? { payload } : {}),
      },
      '*'
    );
  }

  function EicerikWidget() {}

  EicerikWidget.ready = function() {
    if (readySent) return;
    readySent = true;
    postMessage(PROTOCOL.READY);
  };

  EicerikWidget.emit = function(eventName, payload) {
    postMessage(PROTOCOL.EVENT, { eventName, payload });
  };

  EicerikWidget.onCommand = function(commandName, handler) {
    if (typeof commandName !== 'string' || typeof handler !== 'function') return;
    commandHandlers.set(commandName, handler);
  };

  EicerikWidget.getProps = function() {
    if (propsCache) return { ...propsCache };
    try {
      const params = new URLSearchParams(global.location.search);
      const raw = params.get('props');
      if (raw) {
        propsCache = JSON.parse(decodeURIComponent(raw));
        return { ...propsCache };
      }
    } catch {
      // ignore parse error
    }
    return {};
  };

  EicerikWidget.error = function(errorPayload) {
    postMessage(PROTOCOL.ERROR, errorPayload);
  };

  EicerikWidget.complete = function(payload) {
    postMessage(PROTOCOL.COMPLETE, payload);
  };

  function handleMessage(event) {
    if (!event.data || typeof event.data !== 'object') return;
    const data = event.data;
    if (data.type !== PROTOCOL.COMMAND) return;
    if (data.widgetInstanceId !== instanceId) return;
    const handler = commandHandlers.get(data.command);
    if (typeof handler === 'function') {
      try {
        handler(data.payload || {});
      } catch (err) {
        EicerikWidget.error({
          code: 'COMMAND_HANDLER_ERROR',
          message: String(err && err.message),
        });
      }
    }
  }

  if (global.addEventListener) {
    global.addEventListener('message', handleMessage);
  }

  global.EicerikWidget = EicerikWidget;
})(window);
