import { cancelGhLogin } from "#server/services/ghAuth";

export default defineEventHandler(() => {
  cancelGhLogin();
  return { ok: true };
});
