export const WIDGET_MESSAGE_TYPES = {
  EVENT: 'EICERIK_WIDGET_EVENT',
  COMMAND: 'EICERIK_WIDGET_COMMAND',
  READY: 'EICERIK_WIDGET_READY',
  ERROR: 'EICERIK_WIDGET_ERROR',
  COMPLETE: 'EICERIK_WIDGET_COMPLETE',
};

export function isValidWidgetMessage(data) {
  if (!data || typeof data !== 'object') return false;
  return Object.values(WIDGET_MESSAGE_TYPES).includes(data.type);
}

export function createWidgetCommand(widgetInstanceId, command, payload) {
  return {
    type: WIDGET_MESSAGE_TYPES.COMMAND,
    widgetInstanceId,
    command,
    payload: payload || {},
  };
}
