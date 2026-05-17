import { createTrip, defaultSettings } from '../utils/storage.js';

export const sampleSettings = {
  ...defaultSettings,
  userName: 'Jan Baars',
  vehicle: 'Privéauto',
  licensePlate: 'AB-123-C',
  defaultStartAddress: 'Hoofdkantoor, Amsterdam',
  defaultMileageRate: 0.23,
  currency: 'EUR',
};

export const sampleTrips = [
  createTrip(
    {
      id: 'sample-trip-1',
      userName: sampleSettings.userName,
      date: '2026-05-04',
      startTime: '08:30',
      endTime: '09:15',
      startAddress: 'Hoofdkantoor, Amsterdam',
      endAddress: 'Klantlocatie, Utrecht',
      customer: 'Voorbeeld BV',
      project: 'Adviestraject',
      purpose: 'Klantafspraak',
      odometerStart: 42110,
      odometerEnd: 42152,
      finalKm: 42,
      tripType: 'zakelijk',
      note: 'Heenrit naar afspraak.',
    },
    sampleSettings,
  ),
  createTrip(
    {
      id: 'sample-trip-2',
      userName: sampleSettings.userName,
      date: '2026-05-04',
      startTime: '16:20',
      endTime: '17:05',
      startAddress: 'Klantlocatie, Utrecht',
      endAddress: 'Hoofdkantoor, Amsterdam',
      customer: 'Voorbeeld BV',
      project: 'Adviestraject',
      purpose: 'Terugreis klantafspraak',
      manualKm: 42,
      returnTrip: true,
      tripType: 'zakelijk',
    },
    sampleSettings,
  ),
  createTrip(
    {
      id: 'sample-trip-3',
      userName: sampleSettings.userName,
      date: '2026-05-12',
      startAddress: 'Hoofdkantoor, Amsterdam',
      endAddress: '',
      customer: 'Nog aan te vullen',
      purpose: 'Werkbezoek',
      manualKm: '',
      tripType: 'zakelijk',
    },
    sampleSettings,
  ),
];

export const sampleData = {
  version: 2,
  exportedAt: null,
  settings: sampleSettings,
  trips: sampleTrips,
};
