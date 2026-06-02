import { renderToStaticMarkup } from 'react-dom/server';

import LibraryWorkspace from '../features/library/LibraryWorkspace';

const publishers = [{ id: 'pub-1', name: 'Dijital Yayın' }];
const books = [{ id: 'book-1', publisherId: 'pub-1', name: 'Tarih 10', defaultAnswerLayerStylePresetId: 'classic' }];
const activities = [
  {
    id: 'act-1',
    bookId: 'book-1',
    name: 'Kavram Eşleştirme',
    type: 'selection',
    currentSlideId: 'slide-1',
    slides: [{ id: 'slide-1', name: 'Sahne 1', objects: [] }],
  },
];

function renderLibrary(overrides = {}) {
  return renderToStaticMarkup(
    <LibraryWorkspace
      publishers={publishers}
      books={books}
      activities={activities}
      selectedPublisherId="pub-1"
      selectedBookId="book-1"
      onSelectPublisher={() => {}}
      onSelectBook={() => true}
      onOpenActivity={() => {}}
      onPublishersChange={() => {}}
      onBooksChange={() => {}}
      onActivitiesChange={() => {}}
      normalizeBook={(book) => book}
      createActivity={() => ({ id: 'new-activity', slides: [] })}
      notify={() => {}}
      {...overrides}
    />
  );
}

describe('LibraryWorkspace', () => {
  test('renders the modern selection center and hierarchy actions', () => {
    const markup = renderLibrary();

    expect(markup).toContain('İçerik filonuzu yörüngeye taşıyın');
    expect(markup).toContain('Dijital Yayın');
    expect(markup).toContain('Tarih 10');
    expect(markup).toContain('Kavram Eşleştirme');
    expect(markup).toContain('PDF Stüdyo');
    expect(markup).toContain('Editörde aç');
  });
});
