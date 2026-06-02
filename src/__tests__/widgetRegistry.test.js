import { buildWidgetIframeSrc } from '../widgets/WidgetRegistry';

describe('widget iframe source resolution', () => {
  test('uses the resolved in-session entry URL for an uploaded widget', () => {
    expect(
      buildWidgetIframeSrc({
        widgetId: 'uploaded-widget',
        entryUrl: 'blob:http://localhost/widget-entry',
        instanceId: 'widget-1',
      })
    ).toBe('blob:http://localhost/widget-entry');
  });

  test('uses packaged paths ahead of temporary entry URLs for export playback', () => {
    const src = buildWidgetIframeSrc({
      widgetId: 'uploaded-widget',
      basePath: 'widgets/custom/uploaded-widget',
      entry: 'index.html',
      entryUrl: 'blob:http://localhost/widget-entry',
      instanceId: 'widget-1',
    });

    expect(src).toContain('widgets/custom/uploaded-widget/index.html?');
    expect(src).toContain('instanceId=widget-1');
  });
});
