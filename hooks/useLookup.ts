import { getLookups } from "@/services/lookupService";
import { useQuery } from "@tanstack/react-query";

export const useLookup = (domainList: string[], endpoint?: string) => {
  const query = useQuery({
    queryKey: ["lookups", endpoint, domainList],
    queryFn: () => getLookups(domainList, endpoint),
    enabled: Boolean(endpoint),
    retry: 0,
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60,
  });

  const getDomain = (domainCode: string) =>
    query.data?.data?.lookupList.filter((item) => String(item.domain) === domainCode) ?? [];

  return { ...query, getDomain };
};
