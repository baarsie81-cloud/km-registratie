import { toNumber } from './calculations.js';

export const TRIP_STATUS = {
  COMPLETE: 'compleet',
  INCOMPLETE: 'incompleet',
};

export function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

export function isTripComplete(trip) {
  return (
    hasValue(trip.date) &&
    hasValue(trip.startAddress) &&
    hasValue(trip.endAddress) &&
    (trip.tripType !== 'zakelijk' || hasValue(trip.purpose)) &&
    toNumber(trip.finalKm) > 0
  );
}

export function validateTripForm(trip) {
  const errors = [];
  const warnings = [];

  if (!hasValue(trip.date)) errors.push('Datum is verplicht.');
  if (!hasValue(trip.startAddress)) errors.push('Startadres is verplicht.');
  if (!hasValue(trip.endAddress)) errors.push('Eindadres is verplicht.');
  if (trip.tripType === 'zakelijk' && !hasValue(trip.purpose)) {
    errors.push('Doel van de rit is verplicht bij een zakelijke rit.');
  }
  if (!hasValue(trip.finalKm)) errors.push('Aantal kilometers is verplicht.');

  if (hasValue(trip.finalKm) && toNumber(trip.finalKm) === 0) {
    warnings.push('Aantal kilometers is 0. Controleer of dit klopt.');
  }
  if (
    trip.tripType === 'zakelijk' &&
    (!hasValue(trip.customer) || !hasValue(trip.project))
  ) {
    warnings.push('Zakelijke rit heeft geen klant en/of project. Opslaan mag wel.');
  }

  return { errors, warnings };
}

export function getTripStatus(trip) {
  return isTripComplete(trip) ? TRIP_STATUS.COMPLETE : TRIP_STATUS.INCOMPLETE;
}

export function validateBackupData(data) {
  return (
    data &&
    typeof data === 'object' &&
    (Array.isArray(data.trips) || Array.isArray(data.rides)) &&
    data.settings &&
    typeof data.settings === 'object'
  );
}
