export interface Country {
  id: number;
  iso2: string;
  name: string;
}

export interface governorate {
    id: number;
    countryId: number;
    code: string;
    name: string;
}

export interface district {
    id: number;
    governorateId: number;
    code: string;
    name: string;
}

export interface RegionsData {
  countries: Country[];
  governorates: governorate[];
  districts: district[];
}

export interface Cities {
  id: number;
  districtId: number;
  code: string;
  name: string;
}
export interface CitiesResponse {
  cities: Cities[];
}