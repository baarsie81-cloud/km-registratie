export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = String(value).replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function roundCurrency(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

export function roundKm(value) {
  return Math.round(toNumber(value) * 10) / 10;
}

export function calculateKmFromOdometer(odometerStart, odometerEnd) {
  const start = toNumber(odometerStart, null);
  const end = toNumber(odometerEnd, null);

  if (start === null || end === null || end < start) {
    return '';
  }

  return roundKm(end - start);
}

export function calculateFinalKm(trip) {
  const manualKm = toNumber(trip.manualKm, null);
  const calculatedKm = toNumber(trip.calculatedKm, null);

  if (manualKm !== null && manualKm > 0) return roundKm(manualKm);
  if (calculatedKm !== null && calculatedKm > 0) return roundKm(calculatedKm);

  return '';
}

export function calculateDeductibleAmount(finalKm, mileageRate) {
  const km = toNumber(finalKm);
  const rate = toNumber(mileageRate);
  return roundCurrency(km * rate);
}

export function calculateStraightLineKm(startLat, startLng, endLat, endLng) {
  const lat1 = toNumber(startLat, null);
  const lng1 = toNumber(startLng, null);
  const lat2 = toNumber(endLat, null);
  const lng2 = toNumber(endLng, null);

  if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) {
    return '';
  }

  const earthRadiusKm = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return roundKm(earthRadiusKm * c);
}

export function enrichTripCalculations(trip) {
  const calculatedKm =
    trip.calculatedKm === '' || trip.calculatedKm === undefined
      ? calculateKmFromOdometer(trip.odometerStart, trip.odometerEnd)
      : trip.calculatedKm;
  const finalKm = trip.finalKm || calculateFinalKm({ ...trip, calculatedKm });
  const deductibleAmount = calculateDeductibleAmount(finalKm, trip.mileageRate);

  return {
    ...trip,
    calculatedKm,
    finalKm,
    deductibleAmount,
  };
}
