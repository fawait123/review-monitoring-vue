import { listItems } from "#server/services/db/folder-items";

export default defineEventHandler(async () => {
  const items = await listItems();
  return { items };
});
