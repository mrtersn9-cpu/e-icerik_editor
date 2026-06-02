function normalizeSearchText(value) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR');
}

export function countPublisherBooks(books, publisherId) {
  return books.filter((book) => book.publisherId === publisherId).length;
}

export function countPublisherActivities(books, activities, publisherId) {
  const publisherBookIds = new Set(
    books.filter((book) => book.publisherId === publisherId).map((book) => book.id)
  );
  return activities.filter((activity) => publisherBookIds.has(activity.bookId)).length;
}

export function countBookActivities(activities, bookId) {
  return activities.filter((activity) => activity.bookId === bookId).length;
}

export function canDeletePublisher(books, publisherId) {
  return countPublisherBooks(books, publisherId) === 0;
}

export function canDeleteBook(activities, bookId) {
  return countBookActivities(activities, bookId) === 0;
}

export function filterAndSortLibraryItems(items, { search = '', sortBy = 'name', getChildCount }) {
  const normalizedSearch = normalizeSearchText(search);
  const visible = normalizedSearch
    ? items.filter((item) => normalizeSearchText(item.name).includes(normalizedSearch))
    : [...items];

  return visible.sort((left, right) => {
    if (sortBy === 'count-desc' || sortBy === 'count-asc') {
      const direction = sortBy === 'count-desc' ? -1 : 1;
      const countDifference = (getChildCount(left) - getChildCount(right)) * direction;
      if (countDifference) return countDifference;
    }
    return String(left.name || '').localeCompare(String(right.name || ''), 'tr', {
      sensitivity: 'base',
    });
  });
}
