import { selectNeedsProfileSetup, useAuthStore } from "@/stores/authStore";

// Support works during profile setup (guide 15), so the same screens are mounted in
// both the setup stack and the Account stack. Navigate within whichever one is active.
const ROUTES = {
  setup: { list: "/(setup)/support", ticket: "/(setup)/support-ticket", create: "/(setup)/support-new" },
  dashboard: { list: "/(dashboard)/(menu)/support", ticket: "/(dashboard)/(menu)/support-ticket", create: "/(dashboard)/(menu)/support-new" },
} as const;

export function useSupportRoutes() {
  return useAuthStore(selectNeedsProfileSetup) ? ROUTES.setup : ROUTES.dashboard;
}
