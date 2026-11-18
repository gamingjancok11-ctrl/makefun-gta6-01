// The nine districts of CALDERA BAY: bounds, building style, palette accent.
// A volcanic island city — black-sand beaches, lava-rock cliffs, neon downtown.
export const DISTRICTS = [
  { id: 'heights', name: 'Caldera Heights', bounds: [-240, -240, -80, -80], style: 'villa', accent: 0xd9a441, blurb: 'Hillside villas above the crater lake.' },
  { id: 'downtown', name: 'Neon Downtown', bounds: [-80, -240, 80, -80], style: 'tower', accent: 0xff2e88, blurb: 'Glass towers and neon over the bay.' },
  { id: 'airstrip', name: 'Airstrip Flats', bounds: [80, -240, 240, -80], style: 'hangar', accent: 0x9fb4c7, blurb: 'Private jets and empty hangars.' },
  { id: 'foundry', name: 'Old Foundry', bounds: [-240, -80, -80, 80], style: 'industrial', accent: 0xff6b00, blurb: 'Smelters, silos and rust.' },
  { id: 'market', name: 'Night Market', bounds: [-80, -80, 80, 80], style: 'market', accent: 0xffe600, blurb: 'Stalls, lanterns and late deals.' },
  { id: 'marina', name: 'Marina Bay', bounds: [80, -80, 240, 80], style: 'marina', accent: 0x00e5ff, blurb: 'Yachts, piers and salt air.' },
  { id: 'beach', name: 'Black Sand Beach', bounds: [-240, 80, -80, 240], style: 'beach', accent: 0x3a3348, blurb: 'Volcanic sand, surf shacks.' },
  { id: 'causeway', name: 'Causeway South', bounds: [-80, 80, 80, 240], style: 'causeway', accent: 0x7cff00, blurb: 'Bridges to the south islets.' },
  { id: 'docks', name: 'Palmera Docks', bounds: [80, 80, 240, 240], style: 'docks', accent: 0x2ecc71, blurb: 'Cranes, containers, cargo ships.' },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    const [x0, z0, x1, z1] = d.bounds;
    if (x >= x0 && x < x1 && z >= z0 && z < z1) return d;
  }
  return DISTRICTS[4];
}

export function districtById(id) {
  return DISTRICTS.find((d) => d.id === id) || DISTRICTS[4];
}

/** Centre of a district, for mission targets and spawn points. */
export function districtCentre(id) {
  const d = districtById(id);
  const [x0, z0, x1, z1] = d.bounds;
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
}
