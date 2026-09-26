/**
 * Where the shop is.
 *
 * This is the single source of truth. The footer, the About band and the
 * "Find us" map used to each hardcode their own address and they disagreed
 * (Bole Road, Addis Ababa vs Posta, Adama). Everything now reads from here,
 * so fixing the address is a one-line change in one file.
 *
 * ---------------------------------------------------------------------------
 * VERIFY BEFORE LAUNCH. The coordinates below are a Bole Road, Addis Ababa
 * placeholder and the landmark list is indicative. Drop a real pin, confirm
 * the floor/building and correct the landmarks before this goes live — a map
 * that sends someone to the wrong block is worse than no map.
 * ---------------------------------------------------------------------------
 */
export const studioLocation = {
  name: "NOIR Barbers",

  /** Decimal degrees, WGS84. Used for the map pin and the directions links. */
  coordinates: {
    latitude: 9.0195,
    longitude: 38.753,
  },

  /** Shown on the pin and in the directions query. */
  placeLabel: "NOIR Barbers, Bole Road",

  /** Short, human address lines. Kept separate from the maps query. */
  addressLines: {
    street: "Bole Road, Bole",
    building: "NOIR Barbers, 2nd floor",
    district: "Bole",
    city: "Addis Ababa",
    country: "Ethiopia",
  },

  /** One line for copy/paste and for the copy-to-clipboard button. */
  get fullAddress() {
    const { street, building, city, country } = this.addressLines;

    return [building, street, city, country].filter(Boolean).join(", ");
  },

  hours: {
    /** 0 = Sunday. Mirrors backend/core/settings.py BOOKING_OPENING/CLOSING. */
    open: 9,
    close: 21,
    daysLabelKey: "findUs.openDaily",
  },

  /**
   * How to find the door, in the order a visitor will hit it.
   * `icon` maps to a lucide icon in components/sections/FindUs.jsx.
   */
  landmarks: [
    { id: "airport", icon: "plane", approxMinutes: 10, labelKey: "findUs.landmarkAirport" },
    { id: "metro", icon: "train", approxMinutes: 6, labelKey: "findUs.landmarkMetro" },
    { id: "parking", icon: "car", approxMinutes: 3, labelKey: "findUs.landmarkParking" },
    { id: "entrance", icon: "door", approxMinutes: 1, labelKey: "findUs.landmarkEntrance" },
  ],

  /**
   * Landmark minutes are intentionally vague — walk or drive depending on
   * traffic. They exist to answer "how far is this", not to be a routing
   * engine. Real distances come from the directions link.
   */
  approxNoteKey: "findUs.approxNote",

  /**
   * Zoom padding for the embedded map, as [west, south, east, north] in
   * decimal degrees. Roughly a 900m x 600m box around the pin.
   */
  mapBounds: {
    west: 38.7485,
    south: 9.0167,
    east: 38.7575,
    north: 9.0223,
  },
};

const { latitude, longitude } = studioLocation.coordinates;

/**
 * OpenStreetMap embed.
 *
 * Used instead of Google Maps because the OSM embed needs no API key, no
 * billing account and no console project — it is a plain iframe of
 * openstreetmap.org, so it cannot break when a key expires or a quota is hit.
 */
export function openStreetMapEmbedUrl() {
  const { west, south, east, north } = studioLocation.mapBounds;
  const bbox = [west, south, east, north].map((value) => value.toFixed(5)).join("%2C");
  const marker = `${latitude.toFixed(5)}%2C${longitude.toFixed(5)}`;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
}

/** The same view as a standalone page, for "open in maps". */
export function openStreetMapLink() {
  const { latitude: lat, longitude: lng } = studioLocation.coordinates;

  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

/**
 * Turn-by-turn directions in Google Maps.
 *
 * `travelmode` is one of walking, transit, driving, bicycling. Google Maps is
 * the practical default for getting around Addis, so this is the primary
 * button; OSM is offered beside it for people who prefer it or have no
 * Google account.
 */
export function directionsUrl(travelmode = "driving") {
  const destination = encodeURIComponent(
    `${studioLocation.placeLabel}, ${studioLocation.fullAddress}`
  );

  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${travelmode}`;
}

/** Share the studio's own place, not a route. */
export function showOnGoogleMapsUrl() {
  const { latitude: lat, longitude: lng } = studioLocation.coordinates;

  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export const TRAVEL_MODES = ["walking", "transit", "driving"];
