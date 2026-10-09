const { SECTORS } = require('../config/areas');

// SMS format: "<typeCode> <areaCode>" e.g. "1 NORTHBOUNDARY"
// or keyword style e.g. "WILD ELEPHANT NORTHBOUNDARY"
const TYPE_BY_CODE = {
  '1': 'elephant_sighting',
  '2': 'crop_damage',
  '3': 'wildlife_near_home',
  '4': 'wildlife_blocking_road',
  '5': 'other_wildlife_conflict'
};

const KEYWORDS = [
  { incidentType: 'elephant_sighting', words: ['ELEPHANT'] },
  { incidentType: 'crop_damage', words: ['CROP', 'CROPS'] },
  { incidentType: 'wildlife_near_home', words: ['NEARHOME', 'HOME', 'VILLAGE'] },
  { incidentType: 'wildlife_blocking_road', words: ['ROAD', 'BLOCKING'] },
  { incidentType: 'other_wildlife_conflict', words: ['OTHER'] }
];

// Pure parser (unit tested). Outcomes:
//   complete     -> incidentType + areaCode known
//   menu_reply   -> single digit 1-5 (recovery reply from villager)
//   incomplete   -> missing: 'type' | 'area'
//   unrecognized -> nothing usable
function parseSms(rawText) {
  const text = String(rawText || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!text) return { outcome: 'unrecognized' };
  if (/^[1-5]$/.test(text)) {
    return { outcome: 'menu_reply', typeCode: text, incidentType: TYPE_BY_CODE[text] };
  }

  const compact = text.replace(/[\s_-]/g, '');

  let areaCode = null;
  let areaIndex = -1;
  for (const sector of SECTORS) {
    const idx = compact.indexOf(sector.code);
    if (idx !== -1 && (areaIndex === -1 || idx < areaIndex)) {
      areaIndex = idx;
      areaCode = sector.code;
    }
  }
  const remainder =
    areaIndex === -1
      ? compact
      : compact.slice(0, areaIndex) + compact.slice(areaIndex + areaCode.length);

  let incidentType = null;
  const firstToken = text.split(' ')[0];
  if (TYPE_BY_CODE[firstToken]) {
    incidentType = TYPE_BY_CODE[firstToken];
  } else {
    for (const entry of KEYWORDS) {
      if (entry.words.some((w) => remainder.includes(w))) {
        incidentType = entry.incidentType;
        break;
      }
    }
  }

  if (areaCode && incidentType) return { outcome: 'complete', areaCode, incidentType };
  if (areaCode && !incidentType) return { outcome: 'incomplete', missing: 'type', areaCode };
  if (!areaCode && incidentType) return { outcome: 'incomplete', missing: 'area', incidentType };
  return { outcome: 'unrecognized' };
}

function typeMenuReply() {
  return 'Unable to understand your report. Reply 1-Elephant, 2-Crop Damage, 3-Wildlife Near Home, 4-Wildlife Blocking Road, 5-Other.';
}

function areaHelpReply() {
  return 'Reply with your area, e.g. NORTHBOUNDARY, EASTBOUNDARY, SOUTHBOUNDARY or WESTBOUNDARY.';
}

module.exports = { parseSms, TYPE_BY_CODE, typeMenuReply, areaHelpReply };
