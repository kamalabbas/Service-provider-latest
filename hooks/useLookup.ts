import { getLookups } from "@/services/lookupService";
import { useAuthStore } from "@/stores/authStore";
import { useQuery } from "@tanstack/react-query";

export const useLookup = (domainList: string[], endpoint?: string) => {
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const query = useQuery({
    queryKey: ["lookups", accountId, endpoint, domainList],
    queryFn: ({ signal }) => getLookups(domainList, endpoint, signal),
    enabled: Boolean(endpoint),
    retry: 0,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60,
  });

  const getDomain = (domainCode: string) =>
    query.data?.data?.lookupList.filter((item) => String(item.domain) === domainCode) ?? [];

  return { ...query, getDomain };
};
