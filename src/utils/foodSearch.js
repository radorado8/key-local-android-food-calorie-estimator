export function normalizeFoodSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    // Remove punctuation and spaces so that, for example, "jablko!" and
    // "jablko" are treated as the same search text.
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function sortFoodSearchResults(index, query) {
  const normalizedQuery = normalizeFoodSearchText(query);
  if (!normalizedQuery) return [];

  return index
    .filter(entry => entry.normalizedName.includes(normalizedQuery))
    .sort((a, b) => {
      const aRelevance = a.normalizedName === normalizedQuery ? 0 : a.normalizedName.startsWith(normalizedQuery) ? 1 : 2;
      const bRelevance = b.normalizedName === normalizedQuery ? 0 : b.normalizedName.startsWith(normalizedQuery) ? 1 : 2;
      return aRelevance - bRelevance || b.addedAt - a.addedAt;
    });
}
