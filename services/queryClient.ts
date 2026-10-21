import { QueryClient } from "@tanstack/react-query";

// Shared by the provider and session lifecycle; never recreate it on account changes.
export const queryClient = new QueryClient();
