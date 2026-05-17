import { enrichTripCalculations } from './calculations.js';
import { getIsoTimestamp } from './dateHelpers.js';
import { getTripStatus } from './validation.js';

export const STORAGE_KEY = 'zakelijke-km-logger:v2';
const LEGACY_STORAGE_KEY = 'zakelijke-km-logger:v1';

export const defaultSettings = {
  userName: '',
  vehicle: 'Privéauto',
  licensePlate: '',
  defaultStartAddress: '',
  defaultMileageRate: 0.23,
  currency: 'EUR',
};

export const defaultTrip = {
  id: '',
  userName: '',
  date: '',
  startTime: '',
  endTime: '',
  startAddress: '',
  endAddress: '',
  startLat: '',
  startLng: '',
  endLat: '',
  endLng: '',
  customer: '',
  project: '',
  purpose: '',
  odometerStart: '',
  odometerEnd: '',
  calculatedKm: '',
  manualKm: '',
  finalKm: '',
  returnTrip: false,
  tripType: 'zakelijk',
  mileageRate: 0.23,
  deductibleAmount: 0,
  status: 'incompleet',
  note: '',
  createdAt: '',
  updatedAt: '',
};

export const defaultData = {
  version: 2,
  exportedAt: null,
  settings: defaultSettings,
  trips: [],
};

function mapLegacySettings(settings = {}) {
  return {
    ...defaultSettings,
    ...settings,
    userName: settings.bestuurder || settings.userName || '',
    licensePlate: settings.kenteken || settings.licensePlate || '',
    defaultMileageRate:
      settings.standaardTariefPerKm || settings.defaultMileageRate || 0.23,
  };
}

export function createTrip(input = {}, settings = defaultSettings) {
  const now = getIsoTimestamp();
  const trip = {
    ...defaultTrip,
    ...input,
    id: input.id || crypto.randomUUID(),
    userName: input.userName ?? settings.userName ?? '',
    mileageRate: input.mileageRate ?? settings.defaultMileageRate ?? 0.23,
    startAddress:
      input.startAddress ?? settings.defaultStartAddress ?? defaultTrip.startAddress,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
  const enriched = enrichTripCalculations(trip);

  return {
    ...enriched,
    status: getTripStatus(enriched),
  };
}

export function normalizeData(data) {
  const sourceTrips = Array.isArray(data?.trips) ? data.trips : data?.rides || [];
  const settings = mapLegacySettings(data?.settings);
  const trips = sourceTrips.map((trip) => createTrip(trip, settings));

  return {
    ...defaultData,
    ...data,
    version: 2,
    settings,
    trips,
  };
}

export function loadLocalData() {
  try {
    const stored =
      localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return stored ? normalizeData(JSON.parse(stored)) : defaultData;
  } catch {
    return defaultData;
  }
}

export function saveLocalData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeData(data)));
}

export function clearLocalData() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function createBackup(data) {
  return {
    ...normalizeData(data),
    exportedAt: getIsoTimestamp(),
  };
}
