import { getGhStatus } from "../../services/ghAuth";

export default defineEventHandler(() => getGhStatus());
