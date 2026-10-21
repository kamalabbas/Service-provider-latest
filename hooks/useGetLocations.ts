import { BaseResponse } from "@/interfaces/baseResponse.interface";
import { RegionTypeList } from "@/interfaces/enums";
import { Cities, CitiesResponse, RegionsData } from "@/interfaces/location.interface";
import { GetCities, locationService } from "@/services/locationService";
import { useAuthStore } from "@/stores/authStore";
import { useQuery } from "@tanstack/react-query";

export const useGetLocations = (regionTypeList: RegionTypeList[], endpoint?: string) => {
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  return useQuery<BaseResponse<RegionsData>, Error>({
    queryKey: ["Locations", accountId, endpoint, regionTypeList],
    queryFn: ({ signal }) => locationService(regionTypeList, endpoint, signal),
    enabled: Boolean(endpoint),
  });
};

export const useCities = (countryIso2?: string, governorateId?: number, districtId?: number, endpoint?: string) => {
  const accountId = useAuthStore((state) => state.user?.id ?? null);
  const iso = (countryIso2 ?? "").toUpperCase();
  const govId = Number(governorateId) || 0;
  const distId = Number(districtId) || 0;
  const isSelected = Boolean(iso && govId > 0 && distId > 0);

  return useQuery<BaseResponse<CitiesResponse>, Error, Cities[]>({
    queryKey: ["Cities", accountId, endpoint, iso, govId, distId],
    queryFn: ({ signal }) => GetCities({ countryIso2: iso, governorateId: govId, districtId: distId }, endpoint, signal),
    enabled: isSelected && Boolean(endpoint),
    select: (response) => response.data?.cities ?? [],
    staleTime: 1000 * 60 * 30,
  });
};
