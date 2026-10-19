import { BaseResponse } from "@/interfaces/baseResponse.interface";
import { LookupList } from "@/interfaces/lookup.interface";
import { getData } from "./api";

// The endpoint must come from the approved API contract; no legacy binding remains.
export const getLookups = async (domainList: string[], endpoint?: string) => {
  if (!endpoint) throw new Error("The lookup endpoint is not configured.");
  const params = new URLSearchParams();
  domainList.forEach((domain) => params.append("domainList", domain));
  return getData<BaseResponse<LookupList>>(endpoint, { params });
};
