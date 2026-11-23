/** In-memory profiles, one per studio key. */
const profiles = new Map();

export const getProfile = (key) => profiles.get(key) ?? null;

/** Merge zones into the key's profile, replacing any zone with the same label. */
export function saveZones(key, zones) {
  const profile = profiles.get(key) ?? { zones: {} };
  Object.assign(profile.zones, zones);
  profiles.set(key, profile);
  return profile;
}

export const resetStore = () => profiles.clear();
