/** rebuilds the active filters into a query string for the pagination links */
export const toQueryString = (params: Record<string, any>): string =>
    Object.entries(params)
        .filter(
            ([, value]) =>
                value !== undefined && value !== null && value !== ""
        )
        .map(
            ([key, value]) =>
                `${encodeURIComponent(key)}=${encodeURIComponent(
                    String(value)
                )}`
        )
        .join("&");
