export function orderBackDismissEntries(entries = []) {
  return entries
    .slice()
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || (b.order || 0) - (a.order || 0));
}
