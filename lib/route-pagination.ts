export const ROUTE_PAGE_SIZE = 50;
export const MAX_ROUTE_PAGE_SIZE = 50;

export function normalizeRoutePagination(
  pageValue: string | null | undefined,
  limitValue: string | null | undefined,
) {
  const parsedPage = Number.parseInt(pageValue ?? "", 10);
  const parsedLimit = Number.parseInt(limitValue ?? "", 10);

  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const requestedLimit =
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : ROUTE_PAGE_SIZE;
  const pageSize = Math.min(requestedLimit, MAX_ROUTE_PAGE_SIZE);

  return {page, pageSize};
}
