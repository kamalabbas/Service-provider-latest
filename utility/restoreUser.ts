import { restoreSession } from "@/services/authSession";

export async function restoreUser() {
  await restoreSession();
}
