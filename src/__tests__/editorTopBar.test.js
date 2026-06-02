import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import EditorTopBar from '../components/ribbon/EditorTopBar';

describe('EditorTopBar', () => {
  test('renders a persisted user record that does not contain a name', () => {
    const markup = renderToStaticMarkup(
      <EditorTopBar
        activeUser={{ id: 'kullanici1' }}
        currentProject={{ name: 'Proje' }}
        currentView="publishers"
        dbStatus="connected"
      />
    );

    expect(markup).toContain('K');
    expect(markup).toContain('Kullanıcı değiştir');
  });

  test('uses semantic breadcrumb labels instead of raw numeric record names', () => {
    const markup = renderToStaticMarkup(
      <EditorTopBar
        currentProject={{ name: 'Proje' }}
        currentView="editor"
        dbStatus="connected"
        selPub={{ name: 'deneme' }}
        selBook={{ name: '1' }}
        selActivity={{ name: '-1' }}
      />
    );

    expect(markup).toContain('>Yayınevi</button>');
    expect(markup).toContain('>Kitap</button>');
    expect(markup).toContain('>Etkinlik</button>');
    expect(markup).not.toContain('>1</button>');
    expect(markup).not.toContain('>-1</button>');
  });
});
