import { CreateReferenceChoiceRequest, ReferenceCatalogue, UpdateReferenceChoiceRequest } from "@/interfaces/reference.interface";
import {
  adminCreateReferenceChoice,
  adminListReferenceChoices,
  adminReactivateReferenceChoice,
  adminRetireReferenceChoice,
  adminUpdateReferenceChoice,
  getReferenceChoices,
} from "@/services/referenceService";
import { useAuthStore } from "@/stores/authStore";
import { canViewReferenceAdmin, canViewReferenceChoices } from "@/utility/access";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Keys always include the account ID so a different account never reads this cache.
export const referenceKeys = {
  all: (accountId: string | null) => ["reference", accountId] as const,
  member: (accountId: string | null, catalogue: ReferenceCatalogue) => [...referenceKeys.all(accountId), "member", catalogue] as const,
  admin: (accountId: string | null, catalogue: ReferenceCatalogue) => [...referenceKeys.all(accountId), "admin", catalogue] as const,
};

/** Active choices for a selection control, cached for the session. */
export function useReferenceChoices(catalogue: ReferenceCatalogue) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: referenceKeys.member(user?.id ?? null, catalogue),
    queryFn: ({ signal }) => getReferenceChoices(catalogue, signal),
    enabled: canViewReferenceChoices(user, catalogue),
    // Session boundaries clear the cache; management changes invalidate it.
    staleTime: Infinity,
    select: (response) => response.data ?? [],
  });
}

/**
 * A choice can be retired elsewhere while a form is open. Forms call this after
 * a validation error so the next attempt uses current choices.
 */
export function useInvalidateReferenceChoices() {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return () => queryClient.invalidateQueries({ queryKey: referenceKeys.all(accountId) });
}

// Admin (guide 19): management lists include inactive rows.
export function useManagedReferenceChoices(catalogue: ReferenceCatalogue) {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: referenceKeys.admin(user?.id ?? null, catalogue),
    queryFn: ({ signal }) => adminListReferenceChoices(catalogue, signal),
    enabled: canViewReferenceAdmin(user),
    select: (response) => response.data ?? [],
  });
}

export function useReferenceChoiceManagement(catalogue: ReferenceCatalogue) {
  const queryClient = useQueryClient();
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  // Member and management lists both change; refetch every catalogue view.
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: referenceKeys.all(accountId) });

  return {
    create: useMutation({ mutationFn: (body: CreateReferenceChoiceRequest) => adminCreateReferenceChoice(catalogue, body), onSuccess }),
    update: useMutation({
      mutationFn: ({ code, body }: { code: string; body: UpdateReferenceChoiceRequest }) => adminUpdateReferenceChoice(catalogue, code, body),
      onSuccess,
    }),
    retire: useMutation({ mutationFn: (code: string) => adminRetireReferenceChoice(catalogue, code), onSuccess }),
    reactivate: useMutation({ mutationFn: (code: string) => adminReactivateReferenceChoice(catalogue, code), onSuccess }),
  };
}
