import { cancelGhLogin } from "../../services/ghAuth";

export default defineEventHandler(() => {
  cancelGhLogin();
  return { ok: true };
});
