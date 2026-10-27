import { QueryClient } from "@tanstack/react-query";

// Shared by the provider and session lifecycle; never recreate it on account changes.
// Retry manually after state has been checked. In particular, do not replay a
// timed-out mutation or multiply the transport's single 401 refresh/retry.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
