// World layout: a 12x12 grid of city blocks separated by roads.
export const HALF = 600;        // world spans -600..600 on x and z
export const BLOCK = 100;       // road centre-line spacing
export const ROAD = 18;         // road width
export const LINES = 13;        // road lines 0..12
export const NB = 12;           // blocks per axis
export const line = (i) => -HALF + i * BLOCK;
export const RAIL_Z = 250;      // local train track runs along x at this z
export const SEA_X = -640;      // everything west of this is the Arabian Sea
export const BOUND = 650;
export const LANE = 4.5;        // lane offset from road centre (India drives on the LEFT)
export const SIDE = 11;         // pedestrian walking line offset from road centre

export function district(bx, bz) {
  if (bx === 0 && bz === 2) return 'plaza';
  if ((bx === 2 || bx === 3) && bz === 10) return 'maidan';
  if (bx === 6 && bz === 10) return 'mandir';
  if (bx === 7 && bz === 4) return 'police';
  if (bx === 3 && bz === 3) return 'hospital';
  if (bz === 8) return 'rail';
  if (bx >= 4 && bx <= 6 && bz >= 4 && bz <= 6) return 'bazaar';
  if (bx >= 8 && bz <= 4) return 'towers';
  if (bx >= 8 && bz >= 9) return 'chawl';
  if (bx === 0) return 'promenade';
  return 'residential';
}

export const DISTRICT_NAMES = {
  plaza: 'Darwaza Plaza',
  maidan: 'Gully Cricket Maidan',
  mandir: 'Mandir Chowk',
  police: 'Police Thana',
  hospital: 'Sarkari Hospital',
  rail: 'Local Station Area',
  bazaar: 'Purana Bazaar',
  towers: 'Tower Heights',
  chawl: 'Chawl Colony',
  promenade: 'Marine Promenade',
  residential: 'Housing Society Nagar',
  sea: 'Arabian Sea Beach',
};

export function cellOf(x, z) {
  const bx = Math.max(0, Math.min(NB - 1, Math.floor((x + HALF) / BLOCK)));
  const bz = Math.max(0, Math.min(NB - 1, Math.floor((z + HALF) / BLOCK)));
  return [bx, bz];
}

export function areaName(x, z) {
  if (x < -609) return DISTRICT_NAMES.sea;
  const [bx, bz] = cellOf(x, z);
  return DISTRICT_NAMES[district(bx, bz)];
}
