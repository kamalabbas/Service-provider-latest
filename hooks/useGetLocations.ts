import { BaseResponse } from "@/interfaces/baseResponse.interface";
import { RegionTypeList } from "@/interfaces/enums";
import { Cities, CitiesResponse, RegionsData } from "@/interfaces/location.interface";
import { GetCities, locationService } from "@/services/locationService";
import { useQuery } from "@tanstack/react-query";

export const useGetLocations = (regionTypeList: RegionTypeList[], endpoint?: string) =>
  useQuery<BaseResponse<RegionsData>, Error>({
    queryKey: ["Locations", endpoint, regionTypeList],
    queryFn: () => locationService(regionTypeList, endpoint),
    enabled: Boolean(endpoint),
  });

export const useCities = (countryIso2?: string, governorateId?: number, districtId?: number, endpoint?: string) => {
  const iso = (countryIso2 ?? "").toUpperCase();
  const govId = Number(governorateId) || 0;
  const distId = Number(districtId) || 0;
  const isSelected = Boolean(iso && govId > 0 && distId > 0);

  return useQuery<BaseResponse<CitiesResponse>, Error, Cities[]>({
    queryKey: ["Cities", endpoint, iso, govId, distId],
    queryFn: () => GetCities({ countryIso2: iso, governorateId: govId, districtId: distId }, endpoint),
    enabled: isSelected && Boolean(endpoint),
    select: (response) => response.data?.cities ?? [],
    staleTime: 1000 * 60 * 30,
  });
};
