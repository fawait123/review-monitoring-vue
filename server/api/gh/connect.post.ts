import { startGhLogin } from "#server/services/ghAuth";

export default defineEventHandler(() => startGhLogin());
