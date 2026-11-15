// The list pages show everything (filtered and paged in the browser), so load
// every page from the server.
export const fetchAll = async (listFn, key, params = {}, pageSize = 500) => {
  const items = [];
  for (let page = 1; ; page += 1) {
    const res = await listFn({ ...params, page, limit: pageSize });
    items.push(...(res[key] || []));
    const pages = res.pagination?.pages ?? 1;
    if (page >= pages) return items;
  }
};
