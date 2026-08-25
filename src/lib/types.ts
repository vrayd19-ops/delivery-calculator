export type Coordinate = [number, number]; // [lon, lat]
export type AddressPoint = { displayAddress: string; normalizedAddress: string; latitude: number; longitude: number; uri?: string };
export type RouteResult = { coordinates: Coordinate[]; totalMeters: number; status: string };
export type RouteBreakdown = { totalKm: number; insideKm: number; outsideKm: number; crossings: Coordinate[]; insideSegments: Coordinate[][]; outsideSegments: Coordinate[][] };
