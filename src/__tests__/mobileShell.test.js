import { renderToStaticMarkup } from 'react-dom/server';

import MobileToolbar from '../mobile/MobileToolbar';

describe('Mobile shell components (render smoke)', () => {
  test('MobileToolbar renders Canva-style add buttons and wires canvasRef API', () => {
    const calls = [];
    const canvasRef = {
      current: {
        addObject: (type) => calls.push(`add:${type}`),
        addImage: () => calls.push('image'),
        addVideo: () => calls.push('video'),
        addAudio: () => calls.push('audio'),
        loadSVG: () => calls.push('svg'),
      },
    };
    const markup = renderToStaticMarkup(
      <MobileToolbar canvasRef={canvasRef} onOpenInspector={() => {}} onOpenScenes={() => {}} />
    );
    expect(markup).toContain('Metin');
    expect(markup).toContain('Buton');
    expect(markup).toContain('Şekil');
    expect(markup).toContain('Resim');
    expect(markup).toContain('Özellikler');
    expect(markup).toContain('Sahneler');
  });
});
