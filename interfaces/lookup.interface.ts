export interface Lookup {
    domain: number;
    code: string;
    description: string;
    setOrder: number;
}

export interface LookupList {
    lookupList: Lookup[];
}