// Generic identity returned by authentication. Product profile fields await the BRDs.
export interface User {
  id: number;
  email: string;
  statusCode?: string;
  userRoleCode?: string;
}
