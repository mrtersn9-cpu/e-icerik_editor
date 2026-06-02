import {
  canDeleteBook,
  canDeletePublisher,
  countBookActivities,
  countPublisherActivities,
  countPublisherBooks,
  filterAndSortLibraryItems,
} from '../features/library/libraryUtils';

const books = [
  { id: 'b2', publisherId: 'p1', name: 'Z Kitabı' },
  { id: 'b1', publisherId: 'p1', name: 'A Kitabı' },
  { id: 'b3', publisherId: 'p2', name: 'Başka Kitap' },
];
const activities = [
  { id: 'a1', bookId: 'b1', name: 'Bir' },
  { id: 'a2', bookId: 'b1', name: 'İki' },
  { id: 'a3', bookId: 'b2', name: 'Üç' },
];

describe('library helpers', () => {
  test('counts publisher and book children', () => {
    expect(countPublisherBooks(books, 'p1')).toBe(2);
    expect(countPublisherActivities(books, activities, 'p1')).toBe(3);
    expect(countBookActivities(activities, 'b1')).toBe(2);
  });

  test('blocks deleting hierarchy parents with children', () => {
    expect(canDeletePublisher(books, 'p1')).toBe(false);
    expect(canDeletePublisher(books, 'empty')).toBe(true);
    expect(canDeleteBook(activities, 'b1')).toBe(false);
    expect(canDeleteBook(activities, 'empty')).toBe(true);
  });

  test('filters and sorts by name or child count', () => {
    expect(
      filterAndSortLibraryItems(books, {
        search: 'kitabı',
        sortBy: 'name',
        getChildCount: (book) => countBookActivities(activities, book.id),
      }).map((book) => book.id)
    ).toEqual(['b1', 'b2']);

    expect(
      filterAndSortLibraryItems(books, {
        sortBy: 'count-desc',
        getChildCount: (book) => countBookActivities(activities, book.id),
      }).map((book) => book.id)
    ).toEqual(['b1', 'b2', 'b3']);
  });
});
