import { getGhStatus } from "#server/services/ghAuth";

export default defineEventHandler(() => getGhStatus());
