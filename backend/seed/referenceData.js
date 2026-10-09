const { THREAT_LEVEL, COLLAR_STATUS, RANGER_STATUS } = require('../utils/collarAlertConstants');

/**
 * Reference data for the operations dashboard: the park boundary and its
 * surrounding settlements, the pre-configured high-risk geofences, the
 * tracked collars and the ranger teams.
 *
 * Shared by seedReferenceData.js and resetOperationalData.js so both always
 * agree on the starting state of a demo.
 */
const PARK = {
  parkId: 'KNP-ANP',
  name: 'Minneriya National Park',
  district: 'Anuradhapura',
  boundary: [
    [81.055, 8.105],
    [81.028, 8.14],
    [81.008, 8.185],
    [81.0, 8.235],
    [81.018, 8.282],
    [81.058, 8.31],
    [81.108, 8.312],
    [81.15, 8.285],
    [81.172, 8.24],
    [81.168, 8.19],
    [81.14, 8.148],
    [81.1, 8.118],
    [81.055, 8.105]
  ],
  settlements: [
    { settlementId: 'S1', name: 'Kiri Veedi', position: [80.958, 8.156] },
    { settlementId: 'S2', name: 'Gokarella Junction', position: [80.94, 8.236] },
    { settlementId: 'S3', name: 'Uttimula Junction', position: [81.186, 8.222] }
  ]
};

const GEOFENCES = [
  {
    zoneId: 'Z1',
    name: 'Elephant Corridor - Western Farmland',
    gridRef: 'G7',
    kind: 'farmland',
    threatLevel: THREAT_LEVEL.CRITICAL,
    settlementIds: ['S1', 'S2'],
    polygon: [
      [81.03, 8.196],
      [81.005, 8.205],
      [80.972, 8.228],
      [80.952, 8.262],
      [80.968, 8.292],
      [81.008, 8.288],
      [81.034, 8.258],
      [81.038, 8.222],
      [81.03, 8.196]
    ]
  },
  {
    zoneId: 'Z2',
    name: 'Village Edge - Kiri Veedi',
    gridRef: 'F9',
    kind: 'village',
    threatLevel: THREAT_LEVEL.HIGH,
    settlementIds: ['S1'],
    polygon: [
      [81.02, 8.108],
      [80.996, 8.115],
      [80.968, 8.14],
      [80.964, 8.172],
      [80.988, 8.182],
      [81.016, 8.162],
      [81.03, 8.132],
      [81.02, 8.108]
    ]
  },
  {
    zoneId: 'Z3',
    name: 'A2 Highway Crossing Corridor',
    gridRef: 'H11',
    kind: 'road',
    threatLevel: THREAT_LEVEL.HIGH,
    settlementIds: ['S3'],
    polygon: [
      [81.176, 8.196],
      [81.208, 8.202],
      [81.226, 8.238],
      [81.212, 8.272],
      [81.18, 8.268],
      [81.17, 8.23],
      [81.176, 8.196]
    ]
  },
  {
    zoneId: 'Z4',
    name: 'Resettlement Plot Boundary',
    gridRef: 'D5',
    kind: 'farmland',
    threatLevel: THREAT_LEVEL.MEDIUM,
    settlementIds: [],
    polygon: [
      [81.06, 8.062],
      [81.1, 8.07],
      [81.128, 8.096],
      [81.12, 8.124],
      [81.086, 8.128],
      [81.06, 8.108],
      [81.052, 8.082],
      [81.06, 8.062]
    ]
  }
];

const COLLARS = [
  {
    collarId: 'E-402',
    gpsDeviceId: 'GPS-8841',
    species: 'African Elephant',
    sex: 'Female',
    health: 'Stable',
    speciesRisk: 'high',
    status: COLLAR_STATUS.ACTIVE,
    batteryLevel: 78,
    lastKnownLocation: { type: 'Point', coordinates: [81.06, 8.24] }
  },
  {
    collarId: 'E-118',
    gpsDeviceId: 'GPS-7712',
    species: 'Sri Lankan Elephant',
    sex: 'Male',
    health: 'Stable',
    speciesRisk: 'high',
    status: COLLAR_STATUS.ACTIVE,
    batteryLevel: 91,
    lastKnownLocation: { type: 'Point', coordinates: [81.096, 8.268] }
  },
  {
    collarId: 'E-207',
    gpsDeviceId: 'GPS-7903',
    species: 'Sri Lankan Elephant',
    sex: 'Female',
    health: 'Under observation',
    speciesRisk: 'high',
    status: COLLAR_STATUS.ACTIVE,
    batteryLevel: 64,
    lastKnownLocation: { type: 'Point', coordinates: [81.135, 8.226] }
  },
  {
    collarId: 'E-331',
    gpsDeviceId: 'GPS-8020',
    species: 'Sri Lankan Elephant',
    sex: 'Male',
    health: 'Stable',
    speciesRisk: 'high',
    status: COLLAR_STATUS.DELAYED,
    batteryLevel: 55,
    lastKnownLocation: { type: 'Point', coordinates: [81.09, 8.2] }
  },
  {
    collarId: 'E-455',
    gpsDeviceId: 'GPS-8155',
    species: 'Sri Lankan Leopard',
    sex: 'Male',
    health: 'Stable',
    speciesRisk: 'medium',
    status: COLLAR_STATUS.ACTIVE,
    batteryLevel: 88,
    lastKnownLocation: { type: 'Point', coordinates: [81.072, 8.19] }
  },
  {
    collarId: 'E-512',
    gpsDeviceId: 'GPS-8290',
    species: 'Sri Lankan Elephant',
    sex: 'Female',
    health: 'Unknown',
    speciesRisk: 'high',
    status: COLLAR_STATUS.ACTIVE,
    batteryLevel: 12,
    lastKnownLocation: { type: 'Point', coordinates: [81.15, 8.278] }
  }
];

const RANGER_TEAMS = [
  { rangerId: 'RT-01', name: 'Ranger Team Kandy', status: RANGER_STATUS.AVAILABLE, position: [81.021, 8.191] },
  { rangerId: 'RT-02', name: 'Ranger Team Matale', status: RANGER_STATUS.AVAILABLE, position: [81.083, 8.243] },
  { rangerId: 'RT-03', name: 'Ranger Team Kurunegala', status: RANGER_STATUS.ON_PATROL, position: [80.985, 8.212] }
];

module.exports = { PARK, GEOFENCES, COLLARS, RANGER_TEAMS };
