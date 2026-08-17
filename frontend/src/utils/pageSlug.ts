/** Slug shown next to a crawled page title: the last path segment of its URL. */
export function pageSlug(url: string): string {
  const tail = url.split('/').findLast(Boolean) ?? '';
  return decodeURIComponent(tail).toLowerCase();
}
