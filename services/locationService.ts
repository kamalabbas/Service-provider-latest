import { BaseResponse } from "@/interfaces/baseResponse.interface";
import { CitiesResponse, RegionsData } from "@/interfaces/location.interface";
import { getData } from "./api";

export interface GetCitiesParams {
  countryIso2: string;
  governorateId: number;
  districtId: number;
}

// Supply endpoint paths only after the Service Provider contract is approved.
export const locationService = async (regionTypeList: string[], endpoint?: string) => {
  if (!endpoint) throw new Error("The regions endpoint is not configured.");
  const params = new URLSearchParams();
  regionTypeList.forEach((regionType) => params.append("regionTypeList", regionType));
  return getData<BaseResponse<RegionsData>>(endpoint, { params });
};

export const GetCities = async (params: GetCitiesParams, endpoint?: string) => {
  if (!endpoint) throw new Error("The cities endpoint is not configured.");
  return getData<BaseResponse<CitiesResponse>>(endpoint, { params });
};
