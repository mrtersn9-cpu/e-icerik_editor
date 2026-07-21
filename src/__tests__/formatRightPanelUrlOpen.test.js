import { renderToStaticMarkup } from 'react-dom/server';

import { FormatRightPanelContent } from '../features/editor-workspace/right/panels/FormatRightPanel';

// "URL Aç" (URLAc) tetikleyici eylemi seçiliyken Hedef alanının serbest metin
// (TextInput) olarak render edildiğini doğrular. Daha önce targetOptions bu eylem
// için boş dizi döndüğü için alan hiç görünmüyordu (bkz. AGENTS.md/CLAUDE.md kırık
// işler listesi).
function buildActivity(triggerValue) {
  const button = {
    id: 'btn1',
    type: 'button',
    label: 'Bağlantı Butonu',
    layerId: 'base',
  };
  return {
    id: 'activity1',
    objects: [button],
    triggers: [
      {
        id: 'trigger1',
        when: 'onClick',
        target: 'btn1',
        action: 'URLAc',
        value: triggerValue,
        name: 'Bağlantı Butonu tıklama görevi',
      },
    ],
  };
}

function renderPanel({ activity, object }) {
  const controller = {
    activity,
    selectedObject: object,
    selectedObjects: [object],
    commands: {},
    ribbonController: { can: {} },
    layers: [],
    slides: [],
    activities: [],
    present: { variables: [] },
    objects: activity.objects,
    resolvedLayerNames: {},
    onUpdateActivity: () => {},
  };
  return renderToStaticMarkup(<FormatRightPanelContent controller={controller} />);
}

describe('FormatRightPanel - URL Aç tetikleyicisi', () => {
  test('URLAc seçiliyken buton nesnesinde serbest metin URL alanı render edilir', () => {
    const activity = buildActivity('https://ornek.com');
    const object = activity.objects[0];

    const markup = renderPanel({ activity, object });

    expect(markup).toContain('Bağlantı Adresi');
    expect(markup).toContain('type="text"');
    expect(markup).toContain('placeholder="https://..."');
    expect(markup).toContain('value="https://ornek.com"');
    // Eski davranışta bu alan hiç render edilmiyordu; NativeSelect (Hedef) yerine
    // artık TextInput geldiğinden "Hedef" etiketi bu eylem için görünmemeli.
    expect(markup).not.toContain('>Hedef<');
  });

  test('URLAc değeri boşken bile alan görünür kalır (targetOptions boş olsa da)', () => {
    const activity = buildActivity('');
    const object = activity.objects[0];

    const markup = renderPanel({ activity, object });

    expect(markup).toContain('Bağlantı Adresi');
    expect(markup).toContain('placeholder="https://..."');
  });
});
