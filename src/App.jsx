import { useEffect, useMemo, useRef, useState } from 'react';
import { sampleData } from './data/sampleData.js';
import {
  calculateDeductibleAmount,
  calculateKmFromOdometer,
  calculateStraightLineKm,
  toNumber,
} from './utils/calculations.js';
import {
  formatDate,
  getCurrentTime,
  getIsoTimestamp,
  getTodayDate,
} from './utils/dateHelpers.js';
import {
  clearLocalData,
  createTrip,
  loadLocalData,
  normalizeData,
  saveLocalData,
} from './utils/storage.js';
import { validateTripForm } from './utils/validation.js';

const APP_VERSION = '1.0.0';
const EXPORT_FORMAT_VERSION = '1.0';

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'nieuwe-rit', label: 'Nieuwe rit' },
  { id: 'gps-rit', label: 'GPS-rit' },
  { id: 'ritten', label: 'Ritten' },
  { id: 'rapportage', label: 'Rapportage' },
  { id: 'backup', label: 'Backup/export' },
  { id: 'instellingen', label: 'Instellingen' },
];

const emptyFilters = {
  search: '',
  year: 'alle',
  month: 'alle',
  quarter: 'alle',
  customer: 'alle',
  tripType: 'alle',
  status: 'alle',
};

const emptyReportFilters = {
  year: 'alle',
  month: 'alle',
  quarter: 'alle',
  customer: 'alle',
  project: 'alle',
};

const defaultBackupPeriod = {
  type: 'year',
  year: String(new Date().getFullYear()),
  month: String(new Date().getMonth() + 1),
  quarter: String(Math.ceil((new Date().getMonth() + 1) / 3)),
};

function getInitialData() {
  return loadLocalData();
}

function getYear(date) {
  return date ? new Date(`${date}T00:00:00`).getFullYear() : null;
}

function getMonth(date) {
  return date ? new Date(`${date}T00:00:00`).getMonth() + 1 : null;
}

function getQuarter(date) {
  const month = getMonth(date);
  return month ? Math.ceil(month / 3) : null;
}

function getMonthLabel(month) {
  if (!month) return 'Geen maand';
  return new Intl.DateTimeFormat('nl-NL', { month: 'long' }).format(
    new Date(2026, month - 1, 1),
  );
}

function isCountedForDeduction(trip) {
  return trip.tripType === 'zakelijk' && trip.status === 'compleet';
}

function createReportRow(label, trips) {
  const countedTrips = trips.filter(isCountedForDeduction);

  return {
    label,
    tripCount: trips.length,
    businessKm: countedTrips.reduce((sum, trip) => sum + Number(trip.finalKm || 0), 0),
    amount: countedTrips.reduce(
      (sum, trip) => sum + Number(trip.deductibleAmount || 0),
      0,
    ),
    excludedCount: trips.length - countedTrips.length,
  };
}

function groupTrips(trips, getKey, getLabel) {
  const groups = new Map();

  trips.forEach((trip) => {
    const key = getKey(trip);
    if (!key) return;
    if (!groups.has(key)) {
      groups.set(key, {
        label: getLabel(trip),
        trips: [],
      });
    }
    groups.get(key).trips.push(trip);
  });

  return [...groups.entries()].map(([key, group]) => ({
    key,
    ...createReportRow(group.label, group.trips),
  }));
}

function getExclusionReason(trip) {
  if (trip.status === 'incompleet') return 'Incompleet';
  if (trip.tripType === 'privé') return 'Privérit';
  return '';
}

function isCurrentMonth(trip) {
  const now = new Date();
  return getYear(trip.date) === now.getFullYear() && getMonth(trip.date) === now.getMonth() + 1;
}

function isCurrentQuarter(trip) {
  const now = new Date();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
  return getYear(trip.date) === now.getFullYear() && getQuarter(trip.date) === currentQuarter;
}

function isCurrentYear(trip) {
  return getYear(trip.date) === new Date().getFullYear();
}

function isBusinessTrip(trip) {
  return trip.tripType === 'zakelijk';
}

function sortTripsNewestFirst(trips) {
  return [...trips].sort((a, b) => {
    const dateA = `${a.date || ''}T${a.startTime || '00:00'}`;
    const dateB = `${b.date || ''}T${b.startTime || '00:00'}`;
    return dateB.localeCompare(dateA);
  });
}

function sanitizeFilePart(value, fallback = 'gebruiker') {
  const cleaned = String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || fallback;
}

function getPeriodRange(period, trips = []) {
  if (period.type === 'all') {
    const dates = trips.map((trip) => trip.date).filter(Boolean).sort();
    return {
      from: dates[0] || '',
      to: dates[dates.length - 1] || '',
      label: 'Alles',
      fileToken: 'alles',
    };
  }

  const year = Number(period.year || new Date().getFullYear());

  if (period.type === 'month') {
    const month = Number(period.month || 1);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      from: `${year}-${String(month).padStart(2, '0')}-01`,
      to: `${year}-${String(month).padStart(2, '0')}-${lastDay}`,
      label: `${getMonthLabel(month)} ${year}`,
      fileToken: `${year}-${String(month).padStart(2, '0')}`,
    };
  }

  if (period.type === 'quarter') {
    const quarter = Number(period.quarter || 1);
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const lastDay = new Date(year, endMonth, 0).getDate();
    return {
      from: `${year}-${String(startMonth).padStart(2, '0')}-01`,
      to: `${year}-${String(endMonth).padStart(2, '0')}-${lastDay}`,
      label: `Q${quarter} ${year}`,
      fileToken: `${year}-q${quarter}`,
    };
  }

  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
    label: `Jaar ${year}`,
    fileToken: `${year}-jaar`,
  };
}

function isTripInPeriod(trip, range) {
  if (!range.from && !range.to) return true;
  if (!trip.date) return false;
  return (!range.from || trip.date >= range.from) && (!range.to || trip.date <= range.to);
}

function getExportFilename(settings, period, trips, extension) {
  const user = sanitizeFilePart(settings.userName);
  const range = getPeriodRange(period, trips);
  return `km-registratie-${user}-${range.fileToken}.${extension}`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function rowsToCsv(headers, rows) {
  return [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
}

function tripsToCsv(trips) {
  const headers = [
    'Naam gebruiker',
    'Datum',
    'Starttijd',
    'Eindtijd',
    'Startadres',
    'Eindadres',
    'Klant',
    'Project',
    'Doel',
    'Type rit',
    'Definitieve kilometers',
    'Kilometertarief',
    'Bedrag',
    'Status',
    'Notitie',
  ];
  const rows = trips.map((trip) => [
    trip.userName,
    trip.date,
    trip.startTime,
    trip.endTime,
    trip.startAddress,
    trip.endAddress,
    trip.customer,
    trip.project,
    trip.purpose,
    trip.tripType,
    trip.finalKm,
    trip.mileageRate,
    trip.deductibleAmount,
    trip.status,
    trip.note,
  ]);

  return rowsToCsv(headers, rows);
}

function accountantCsv(data, trips, periodRange) {
  const countedTrips = trips.filter(isCountedForDeduction);
  const rate = data.settings.defaultMileageRate;
  const totalKm = countedTrips.reduce((sum, trip) => sum + Number(trip.finalKm || 0), 0);
  const totalAmount = countedTrips.reduce(
    (sum, trip) => sum + Number(trip.deductibleAmount || 0),
    0,
  );
  const headers = [
    'Naam gebruiker',
    'Periode',
    'Aantal zakelijke ritten',
    'Totaal zakelijke kilometers',
    'Kilometertarief',
    'Totaal bedrag',
    'Aantal incomplete ritten',
  ];
  const periodLabel = periodRange.label;
  const rows = [
    [
      data.settings.userName,
      periodLabel,
      countedTrips.length,
      totalKm,
      rate,
      totalAmount,
      trips.filter((trip) => trip.status === 'incompleet').length,
    ],
  ];

  return rowsToCsv(headers, rows);
}

function createJsonExport(data, trips, periodRange) {
  return {
    appName: 'Zakelijke KM Logger',
    exportFormatVersion: EXPORT_FORMAT_VERSION,
    appVersion: APP_VERSION,
    exportedAt: getIsoTimestamp(),
    user: {
      name: data.settings.userName,
      vehicle: data.settings.vehicle,
      licensePlate: data.settings.licensePlate,
      defaultMileageRate: Number(data.settings.defaultMileageRate || 0.23),
    },
    period: {
      from: periodRange.from,
      to: periodRange.to,
    },
    trips,
  };
}

function formatCurrency(value, currency) {
  try {
    return Number(value || 0).toLocaleString('nl-NL', {
      style: 'currency',
      currency: currency || 'EUR',
    });
  } catch {
    return Number(value || 0).toLocaleString('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    });
  }
}

function formatCoordinates(lat, lng) {
  if (lat === '' || lng === '' || lat === null || lng === null) return 'Geen coördinaten';
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

function positionToLocation(position) {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: Math.round(position.coords.accuracy || 0),
  };
}

function getBrowserLocation() {
  if (!('geolocation' in navigator)) {
    return Promise.reject(new Error('GPS is niet beschikbaar in deze browser.'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });
  });
}

function getLocationErrorMessage(error) {
  if (error?.code === 1) {
    return 'GPS-toestemming is geweigerd. Je kunt de rit nog steeds handmatig invullen.';
  }
  if (error?.code === 2) {
    return 'GPS-locatie kon niet worden bepaald. Vul de gegevens handmatig aan.';
  }
  if (error?.code === 3) {
    return 'GPS duurde te lang. Je kunt zonder GPS verdergaan en later corrigeren.';
  }
  return error?.message || 'GPS is niet beschikbaar. Je kunt handmatig verdergaan.';
}

function createEmptyTripForm(settings) {
  return {
    id: '',
    createdAt: '',
    date: getTodayDate(),
    startTime: '',
    endTime: '',
    startAddress: settings.defaultStartAddress || '',
    endAddress: '',
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
    mileageRate: settings.defaultMileageRate || 0.23,
    note: '',
  };
}

function createEmptyGpsDraft(settings) {
  return {
    date: getTodayDate(),
    startTime: getCurrentTime(),
    endTime: '',
    startAddress: settings.defaultStartAddress || '',
    endAddress: '',
    startLat: '',
    startLng: '',
    endLat: '',
    endLng: '',
    startAccuracy: '',
    endAccuracy: '',
    customer: '',
    project: '',
    purpose: '',
    calculatedKm: '',
    manualKm: '',
    finalKm: '',
    returnTrip: false,
    tripType: 'zakelijk',
    mileageRate: settings.defaultMileageRate || 0.23,
    note: '',
  };
}

function tripToForm(trip) {
  return {
    id: trip.id,
    createdAt: trip.createdAt,
    date: trip.date || '',
    startTime: trip.startTime || '',
    endTime: trip.endTime || '',
    startAddress: trip.startAddress || '',
    endAddress: trip.endAddress || '',
    customer: trip.customer || '',
    project: trip.project || '',
    purpose: trip.purpose || '',
    odometerStart: trip.odometerStart ?? '',
    odometerEnd: trip.odometerEnd ?? '',
    calculatedKm: trip.calculatedKm ?? '',
    manualKm: trip.manualKm || trip.finalKm || '',
    finalKm: trip.finalKm || '',
    returnTrip: Boolean(trip.returnTrip),
    tripType: trip.tripType || 'zakelijk',
    mileageRate: trip.mileageRate || 0.23,
    note: trip.note || '',
  };
}

function EmptyState({ title, children }) {
  return (
    <section className="empty-state" aria-label={title}>
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  );
}

function ReportTable({ currency, emptyText = 'Geen gegevens.', rows, title }) {
  return (
    <section className="report-card">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted-text">{emptyText}</p>
      ) : (
        <div className="table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Periode</th>
                <th>Ritten</th>
                <th>Zakelijke km</th>
                <th>Aftrekbaar</th>
                <th>Niet mee</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key || row.label}>
                  <td>{row.label}</td>
                  <td>{row.tripCount}</td>
                  <td>{row.businessKm.toLocaleString('nl-NL')}</td>
                  <td>{formatCurrency(row.amount, currency)}</td>
                  <td>{row.excludedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TripForm({
  currency,
  formErrors,
  mode,
  onCancelEdit,
  onReset,
  onSubmit,
  onUpdate,
  submitWarnings,
  tripForm,
}) {
  return (
    <form className="trip-form" onSubmit={onSubmit}>
      <div className="form-grid two-columns">
        <label>
          Datum *
          <input
            type="date"
            value={tripForm.date}
            onChange={(event) => onUpdate('date', event.target.value)}
          />
        </label>
        <label>
          Type rit
          <select
            value={tripForm.tripType}
            onChange={(event) => onUpdate('tripType', event.target.value)}
          >
            <option value="zakelijk">Zakelijk</option>
            <option value="privé">Privé</option>
          </select>
        </label>
        <label>
          Starttijd
          <input
            type="time"
            value={tripForm.startTime}
            onChange={(event) => onUpdate('startTime', event.target.value)}
          />
        </label>
        <label>
          Eindtijd
          <input
            type="time"
            value={tripForm.endTime}
            onChange={(event) => onUpdate('endTime', event.target.value)}
          />
        </label>
      </div>

      <div className="form-grid">
        <label>
          Startadres *
          <input
            value={tripForm.startAddress}
            onChange={(event) => onUpdate('startAddress', event.target.value)}
            placeholder="Bijv. thuisadres of kantoor"
          />
        </label>
        <label>
          Eindadres *
          <input
            value={tripForm.endAddress}
            onChange={(event) => onUpdate('endAddress', event.target.value)}
            placeholder="Adres van bestemming"
          />
        </label>
      </div>

      <div className="form-grid two-columns">
        <label>
          Klant
          <input
            value={tripForm.customer}
            onChange={(event) => onUpdate('customer', event.target.value)}
            placeholder="Klantnaam"
          />
        </label>
        <label>
          Project
          <input
            value={tripForm.project}
            onChange={(event) => onUpdate('project', event.target.value)}
            placeholder="Project of dossier"
          />
        </label>
      </div>

      <label className="full-label">
        Doel van de rit {tripForm.tripType === 'zakelijk' ? '*' : ''}
        <input
          value={tripForm.purpose}
          onChange={(event) => onUpdate('purpose', event.target.value)}
          placeholder="Bijv. klantafspraak, overleg of werkbezoek"
        />
      </label>

      <div className="form-grid two-columns">
        <label>
          Beginstand kilometerteller
          <input
            inputMode="decimal"
            value={tripForm.odometerStart}
            onChange={(event) => onUpdate('odometerStart', event.target.value)}
            placeholder="Optioneel"
          />
        </label>
        <label>
          Eindstand kilometerteller
          <input
            inputMode="decimal"
            value={tripForm.odometerEnd}
            onChange={(event) => onUpdate('odometerEnd', event.target.value)}
            placeholder="Optioneel"
          />
        </label>
      </div>

      {tripForm.odometerStart &&
        tripForm.odometerEnd &&
        toNumber(tripForm.odometerEnd, -1) < toNumber(tripForm.odometerStart, 0) && (
          <p className="form-warning">
            Eindstand is lager dan beginstand. Controleer de kilometerstanden.
          </p>
        )}

      {tripForm.calculatedKm !== '' && (
        <p className="form-hint">
          Berekend uit kilometerteller: {tripForm.calculatedKm} km. Je mag het
          definitieve totaal hieronder aanpassen.
        </p>
      )}

      <label className="check-row">
        <input
          type="checkbox"
          checked={tripForm.returnTrip}
          onChange={(event) => onUpdate('returnTrip', event.target.checked)}
        />
        Retourtje
      </label>

      <div className="confirmation-panel">
        <label>
          Definitief totaal aantal kilometers *
          <input
            inputMode="decimal"
            value={tripForm.manualKm}
            onChange={(event) => onUpdate('manualKm', event.target.value)}
            placeholder="Totaal aantal kilometers"
          />
        </label>
        <p>
          {tripForm.returnTrip
            ? 'Vul hier altijd het totaal voor de volledige retourrit in, dus heen en terug samen.'
            : 'Vul hier het definitieve totaal voor deze enkele rit in.'}
        </p>
        <strong>
          Verwacht aftrekbaar bedrag:{' '}
          {formatCurrency(
            calculateDeductibleAmount(tripForm.manualKm, tripForm.mileageRate),
            currency,
          )}
        </strong>
      </div>

      <label className="full-label">
        Notitie
        <textarea
          value={tripForm.note}
          onChange={(event) => onUpdate('note', event.target.value)}
          placeholder="Optionele toelichting"
          rows="4"
        />
      </label>

      {(formErrors.length > 0 || submitWarnings.length > 0) && (
        <div className="message-list" aria-live="polite">
          {formErrors.map((error) => (
            <p className="form-error" key={error}>
              {error}
            </p>
          ))}
          {submitWarnings.map((warning) => (
            <p className="form-warning" key={warning}>
              {warning}
            </p>
          ))}
        </div>
      )}

      <div className="form-actions">
        <button className="primary-action" type="submit">
          {mode === 'edit' ? 'Wijzigingen opslaan' : 'Rit opslaan'}
        </button>
        {mode === 'edit' ? (
          <button className="secondary-action" type="button" onClick={onCancelEdit}>
            Bewerken annuleren
          </button>
        ) : (
          <button className="secondary-action" type="button" onClick={onReset}>
            Formulier leegmaken
          </button>
        )}
      </div>
    </form>
  );
}

function GpsReviewForm({
  currency,
  gpsDraft,
  gpsErrors,
  gpsWarnings,
  onCancel,
  onSave,
  onUpdate,
}) {
  return (
    <form className="trip-form" onSubmit={onSave}>
      <div className="gps-summary">
        <div>
          <span>Start</span>
          <strong>{gpsDraft.startTime || '-'}</strong>
          <p>{formatCoordinates(gpsDraft.startLat, gpsDraft.startLng)}</p>
        </div>
        <div>
          <span>Einde</span>
          <strong>{gpsDraft.endTime || '-'}</strong>
          <p>{formatCoordinates(gpsDraft.endLat, gpsDraft.endLng)}</p>
        </div>
      </div>

      {gpsDraft.calculatedKm !== '' && (
        <p className="form-warning">
          Geschatte afstand hemelsbreed: {gpsDraft.calculatedKm} km. Dit is geen
          routeafstand. Bevestig hieronder altijd het definitieve totaal.
        </p>
      )}

      <div className="form-grid">
        <label>
          Startadres *
          <input
            value={gpsDraft.startAddress}
            onChange={(event) => onUpdate('startAddress', event.target.value)}
            placeholder="Vul startadres in"
          />
        </label>
        <label>
          Eindadres *
          <input
            value={gpsDraft.endAddress}
            onChange={(event) => onUpdate('endAddress', event.target.value)}
            placeholder="Vul eindadres in"
          />
        </label>
      </div>

      <div className="form-grid two-columns">
        <label>
          Klant
          <input
            value={gpsDraft.customer}
            onChange={(event) => onUpdate('customer', event.target.value)}
            placeholder="Klantnaam"
          />
        </label>
        <label>
          Project
          <input
            value={gpsDraft.project}
            onChange={(event) => onUpdate('project', event.target.value)}
            placeholder="Project of dossier"
          />
        </label>
      </div>

      <label className="full-label">
        Doel van de rit {gpsDraft.tripType === 'zakelijk' ? '*' : ''}
        <input
          value={gpsDraft.purpose}
          onChange={(event) => onUpdate('purpose', event.target.value)}
          placeholder="Bijv. klantafspraak, overleg of werkbezoek"
        />
      </label>

      <div className="form-grid two-columns">
        <label>
          Type rit
          <select
            value={gpsDraft.tripType}
            onChange={(event) => onUpdate('tripType', event.target.value)}
          >
            <option value="zakelijk">Zakelijk</option>
            <option value="privé">Privé</option>
          </select>
        </label>
        <label>
          Definitief totaal aantal kilometers *
          <input
            inputMode="decimal"
            value={gpsDraft.manualKm}
            onChange={(event) => onUpdate('manualKm', event.target.value)}
            placeholder="Totaal aantal kilometers"
          />
        </label>
      </div>

      <div className="confirmation-panel">
        <p>
          GPS is alleen een hulpmiddel. Sla pas op als adressen en definitieve
          kilometers kloppen.
        </p>
        <strong>
          Verwacht aftrekbaar bedrag:{' '}
          {formatCurrency(
            calculateDeductibleAmount(gpsDraft.manualKm, gpsDraft.mileageRate),
            currency,
          )}
        </strong>
      </div>

      <label className="full-label">
        Notitie
        <textarea
          value={gpsDraft.note}
          onChange={(event) => onUpdate('note', event.target.value)}
          placeholder="Optionele toelichting"
          rows="4"
        />
      </label>

      {(gpsErrors.length > 0 || gpsWarnings.length > 0) && (
        <div className="message-list" aria-live="polite">
          {gpsErrors.map((error) => (
            <p className="form-error" key={error}>
              {error}
            </p>
          ))}
          {gpsWarnings.map((warning, index) => (
            <p className="form-warning" key={`${warning}-${index}`}>
              {warning}
            </p>
          ))}
        </div>
      )}

      <div className="form-actions">
        <button className="primary-action" type="submit">
          GPS-rit opslaan
        </button>
        <button className="secondary-action" type="button" onClick={onCancel}>
          Annuleren
        </button>
      </div>
    </form>
  );
}

function App() {
  const initialData = getInitialData();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState(initialData);
  const [notice, setNotice] = useState('');
  const [tripForm, setTripForm] = useState(() => createEmptyTripForm(initialData.settings));
  const [editingTripId, setEditingTripId] = useState(null);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [reportFilters, setReportFilters] = useState(emptyReportFilters);
  const [formErrors, setFormErrors] = useState([]);
  const [submitWarnings, setSubmitWarnings] = useState([]);
  const [gpsPhase, setGpsPhase] = useState('idle');
  const [gpsDraft, setGpsDraft] = useState(() => createEmptyGpsDraft(initialData.settings));
  const [gpsMessage, setGpsMessage] = useState('');
  const [gpsWarnings, setGpsWarnings] = useState([]);
  const [gpsErrors, setGpsErrors] = useState([]);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [backupPeriod, setBackupPeriod] = useState(defaultBackupPeriod);
  const [pendingImport, setPendingImport] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    saveLocalData(data);
  }, [data]);

  const sortedTrips = useMemo(() => sortTripsNewestFirst(data.trips), [data.trips]);
  const selectedTrip = useMemo(
    () => data.trips.find((trip) => trip.id === selectedTripId) || null,
    [data.trips, selectedTripId],
  );

  const dashboardStats = useMemo(() => {
    const businessTrips = data.trips.filter(isBusinessTrip);
    const sumKm = (trips) =>
      trips.reduce((sum, trip) => sum + Number(trip.finalKm || 0), 0);
    const yearBusinessTrips = businessTrips.filter(isCurrentYear);

    return {
      monthKm: sumKm(businessTrips.filter(isCurrentMonth)),
      quarterKm: sumKm(businessTrips.filter(isCurrentQuarter)),
      yearKm: sumKm(yearBusinessTrips),
      yearAmount: yearBusinessTrips.reduce(
        (sum, trip) => sum + Number(trip.deductibleAmount || 0),
        0,
      ),
      monthTrips: data.trips.filter(isCurrentMonth).length,
      incompleteTrips: data.trips.filter((trip) => trip.status === 'incompleet').length,
      latestTrips: sortedTrips.slice(0, 5),
    };
  }, [data.trips, sortedTrips]);

  const filterOptions = useMemo(() => {
    const years = [...new Set(data.trips.map((trip) => getYear(trip.date)).filter(Boolean))].sort(
      (a, b) => b - a,
    );
    const customers = [
      ...new Set(data.trips.map((trip) => trip.customer).filter((customer) => customer)),
    ].sort((a, b) => a.localeCompare(b, 'nl'));
    const projects = [
      ...new Set(data.trips.map((trip) => trip.project).filter((project) => project)),
    ].sort((a, b) => a.localeCompare(b, 'nl'));

    return { years, customers, projects };
  }, [data.trips]);

  const filteredTrips = useMemo(() => {
    const query = filters.search.trim().toLowerCase();

    return sortedTrips.filter((trip) => {
      const haystack = [
        trip.date,
        trip.startAddress,
        trip.endAddress,
        trip.customer,
        trip.project,
        trip.purpose,
        trip.note,
      ]
        .join(' ')
        .toLowerCase();

      if (query && !haystack.includes(query)) return false;
      if (filters.year !== 'alle' && String(getYear(trip.date)) !== filters.year) return false;
      if (filters.month !== 'alle' && String(getMonth(trip.date)) !== filters.month) return false;
      if (filters.quarter !== 'alle' && String(getQuarter(trip.date)) !== filters.quarter) {
        return false;
      }
      if (filters.customer !== 'alle' && trip.customer !== filters.customer) return false;
      if (filters.tripType !== 'alle' && trip.tripType !== filters.tripType) return false;
      if (filters.status !== 'alle' && trip.status !== filters.status) return false;
      return true;
    });
  }, [filters, sortedTrips]);

  const reportTrips = useMemo(() => {
    return sortedTrips.filter((trip) => {
      if (reportFilters.year !== 'alle' && String(getYear(trip.date)) !== reportFilters.year) {
        return false;
      }
      if (reportFilters.month !== 'alle' && String(getMonth(trip.date)) !== reportFilters.month) {
        return false;
      }
      if (
        reportFilters.quarter !== 'alle' &&
        String(getQuarter(trip.date)) !== reportFilters.quarter
      ) {
        return false;
      }
      if (reportFilters.customer !== 'alle' && trip.customer !== reportFilters.customer) {
        return false;
      }
      if (reportFilters.project !== 'alle' && trip.project !== reportFilters.project) {
        return false;
      }
      return true;
    });
  }, [reportFilters, sortedTrips]);

  const reportData = useMemo(() => {
    const countedTrips = reportTrips.filter(isCountedForDeduction);
    const sumKm = (trips) =>
      trips.reduce((sum, trip) => sum + Number(trip.finalKm || 0), 0);
    const sumAmount = (trips) =>
      trips.reduce((sum, trip) => sum + Number(trip.deductibleAmount || 0), 0);

    const monthRows = groupTrips(
      reportTrips,
      (trip) => {
        const year = getYear(trip.date);
        const month = getMonth(trip.date);
        return year && month ? `${year}-${String(month).padStart(2, '0')}` : '';
      },
      (trip) => `${getMonthLabel(getMonth(trip.date))} ${getYear(trip.date)}`,
    ).sort((a, b) => a.key.localeCompare(b.key));

    const quarterRows = groupTrips(
      reportTrips,
      (trip) => {
        const year = getYear(trip.date);
        const quarter = getQuarter(trip.date);
        return year && quarter ? `${year}-Q${quarter}` : '';
      },
      (trip) => `Q${getQuarter(trip.date)} ${getYear(trip.date)}`,
    ).sort((a, b) => a.key.localeCompare(b.key));

    const yearRows = groupTrips(
      reportTrips,
      (trip) => String(getYear(trip.date) || ''),
      (trip) => String(getYear(trip.date) || 'Geen jaar'),
    ).sort((a, b) => a.key.localeCompare(b.key));

    const customerRows = groupTrips(
      reportTrips,
      (trip) => trip.customer || 'Geen klant',
      (trip) => trip.customer || 'Geen klant',
    ).sort((a, b) => a.label.localeCompare(b.label, 'nl'));

    const projectRows = groupTrips(
      reportTrips,
      (trip) => trip.project || 'Geen project',
      (trip) => trip.project || 'Geen project',
    ).sort((a, b) => a.label.localeCompare(b.label, 'nl'));

    const typeRows = groupTrips(
      reportTrips,
      (trip) => trip.tripType || 'onbekend',
      (trip) => trip.tripType || 'Onbekend',
    ).sort((a, b) => a.label.localeCompare(b.label, 'nl'));

    return {
      countedKm: sumKm(countedTrips),
      countedAmount: sumAmount(countedTrips),
      filteredCount: reportTrips.length,
      countedCount: countedTrips.length,
      incompleteTrips: reportTrips.filter((trip) => trip.status === 'incompleet'),
      excludedTrips: reportTrips.filter((trip) => !isCountedForDeduction(trip)),
      monthRows,
      quarterRows,
      yearRows,
      customerRows,
      projectRows,
      typeRows,
    };
  }, [reportTrips]);

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3600);
  }

  function goToTab(tabId) {
    setActiveTab(tabId);
    if (tabId !== 'ritten') setSelectedTripId(null);
  }

  const backupRange = useMemo(
    () => getPeriodRange(backupPeriod, data.trips),
    [backupPeriod, data.trips],
  );

  const backupTrips = useMemo(
    () => sortTripsNewestFirst(data.trips.filter((trip) => isTripInPeriod(trip, backupRange))),
    [backupRange, data.trips],
  );

  function exportJson() {
    const backup = createJsonExport(data, backupTrips, backupRange);
    downloadFile(
      getExportFilename(data.settings, backupPeriod, data.trips, 'json'),
      JSON.stringify(backup, null, 2),
      'application/json',
    );
    showNotice('JSON-backup is aangemaakt voor de gekozen periode.');
  }

  function exportCsv() {
    downloadFile(
      getExportFilename(data.settings, backupPeriod, data.trips, 'csv'),
      tripsToCsv(backupTrips),
      'text/csv;charset=utf-8',
    );
    showNotice('Ritten-CSV is aangemaakt voor de gekozen periode.');
  }

  function exportAccountantCsv() {
    const filename = getExportFilename(data.settings, backupPeriod, data.trips, 'csv').replace(
      '.csv',
      '-boekhouder.csv',
    );
    downloadFile(
      filename,
      accountantCsv(data, backupTrips, backupRange),
      'text/csv;charset=utf-8',
    );
    showNotice('Boekhouder-overzicht is aangemaakt.');
  }

  function restoreJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (
          parsed?.appName !== 'Zakelijke KM Logger' ||
          parsed?.exportFormatVersion !== EXPORT_FORMAT_VERSION ||
          !Array.isArray(parsed?.trips)
        ) {
          throw new Error('Ongeldig backupbestand');
        }

        setPendingImport({
          raw: parsed,
          summary: {
            userName: parsed.user?.name || '',
            trips: parsed.trips.length,
            from: parsed.period?.from || '',
            to: parsed.period?.to || '',
            duplicateCount: parsed.trips.filter((trip) =>
              data.trips.some((currentTrip) => currentTrip.id === trip.id),
            ).length,
          },
        });
        showNotice('Backup is gecontroleerd. Kies hoe je wilt importeren.');
      } catch {
        setPendingImport(null);
        showNotice('Dit JSON-bestand is geen geldige backup voor deze app.');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  function buildImportData(rawImport, mode) {
    const importedSettings = {
      ...data.settings,
      userName: rawImport.user?.name || data.settings.userName,
      vehicle: rawImport.user?.vehicle || data.settings.vehicle,
      licensePlate: rawImport.user?.licensePlate || data.settings.licensePlate,
      defaultMileageRate:
        rawImport.user?.defaultMileageRate || data.settings.defaultMileageRate,
    };
    const importedTrips = rawImport.trips.map((trip) => createTrip(trip, importedSettings));

    if (mode === 'replace') {
      return normalizeData({
        version: 2,
        settings: importedSettings,
        trips: importedTrips,
      });
    }

    const existingIds = new Set(data.trips.map((trip) => trip.id));
    const newTrips = importedTrips.filter((trip) => !existingIds.has(trip.id));

    return normalizeData({
      ...data,
      trips: [...newTrips, ...data.trips],
    });
  }

  function confirmImport(mode) {
    if (!pendingImport) return;
    const actionText =
      mode === 'replace'
        ? 'Bestaande lokale data wordt vervangen. Doorgaan?'
        : 'Nieuwe ritten worden toegevoegd. Dubbele ids worden overgeslagen. Doorgaan?';

    if (!window.confirm(actionText)) return;

    const nextData = buildImportData(pendingImport.raw, mode);
    setData(nextData);
    setPendingImport(null);
    setSelectedTripId(null);
    setTripForm(createEmptyTripForm(nextData.settings));
    showNotice(mode === 'replace' ? 'Backup is teruggezet.' : 'Backup is toegevoegd.');
  }

  function updateSetting(key, value) {
    setData((current) =>
      normalizeData({
        ...current,
        settings: {
          ...current.settings,
          [key]: value,
        },
      }),
    );
  }

  function saveSettings() {
    saveLocalData(data);
    showNotice('Instellingen zijn opgeslagen.');
  }

  function updateTripForm(key, value) {
    setTripForm((current) => {
      const next = { ...current, [key]: value };

      if (key === 'odometerStart' || key === 'odometerEnd') {
        const calculatedKm = calculateKmFromOdometer(
          key === 'odometerStart' ? value : next.odometerStart,
          key === 'odometerEnd' ? value : next.odometerEnd,
        );
        next.calculatedKm = calculatedKm;

        if (calculatedKm !== '') {
          next.manualKm = String(calculatedKm);
          next.finalKm = String(calculatedKm);
        }
      }

      if (key === 'manualKm') next.finalKm = value;

      return next;
    });
  }

  function updateGpsDraft(key, value) {
    setGpsDraft((current) => ({
      ...current,
      [key]: value,
      ...(key === 'manualKm' ? { finalKm: value } : {}),
    }));
  }

  function resetTripForm() {
    setTripForm(createEmptyTripForm(data.settings));
    setEditingTripId(null);
    setFormErrors([]);
    setSubmitWarnings([]);
  }

  function prepareTripFromForm() {
    return {
      ...tripForm,
      userName: data.settings.userName,
      mileageRate: toNumber(tripForm.mileageRate, data.settings.defaultMileageRate),
      finalKm: tripForm.manualKm,
      manualKm: tripForm.manualKm,
      deductibleAmount: calculateDeductibleAmount(tripForm.manualKm, tripForm.mileageRate),
      updatedAt: getIsoTimestamp(),
    };
  }

  function saveTrip(event) {
    event.preventDefault();
    const preparedTrip = prepareTripFromForm();
    const validation = validateTripForm(preparedTrip);
    setFormErrors(validation.errors);
    setSubmitWarnings(validation.warnings);

    if (validation.errors.length > 0) {
      showNotice('Controleer de verplichte velden.');
      return;
    }

    const savedTrip = createTrip(preparedTrip, data.settings);
    setData((current) => {
      const existingTrip = current.trips.some((trip) => trip.id === savedTrip.id);
      const trips = existingTrip
        ? current.trips.map((trip) => (trip.id === savedTrip.id ? savedTrip : trip))
        : [savedTrip, ...current.trips];

      return normalizeData({ ...current, trips });
    });
    resetTripForm();
    setActiveTab('ritten');
    showNotice(
      validation.warnings.length > 0
        ? `Rit opgeslagen als ${savedTrip.status}. Let op: ${validation.warnings[0]}`
        : `Rit opgeslagen als ${savedTrip.status}.`,
    );
  }

  async function startGpsTrip() {
    const startedDraft = createEmptyGpsDraft(data.settings);
    setGpsBusy(true);
    setGpsMessage('Startlocatie wordt opgehaald...');
    setGpsWarnings([]);
    setGpsErrors([]);

    try {
      const position = await getBrowserLocation();
      const location = positionToLocation(position);
      const warnings =
        location.accuracy > 100
          ? [`Startlocatie is onnauwkeurig: ongeveer ${location.accuracy} meter.`]
          : [];
      setGpsDraft({
        ...startedDraft,
        startLat: location.lat,
        startLng: location.lng,
        startAccuracy: location.accuracy,
      });
      setGpsWarnings(warnings);
      setGpsMessage('Rit is gestart. Er wordt niet op de achtergrond gevolgd.');
    } catch (error) {
      setGpsDraft(startedDraft);
      setGpsWarnings([getLocationErrorMessage(error)]);
      setGpsMessage('Rit is gestart zonder GPS-startlocatie.');
    } finally {
      setGpsBusy(false);
      setGpsPhase('active');
    }
  }

  async function finishGpsTrip() {
    setGpsBusy(true);
    setGpsMessage('Eindlocatie wordt opgehaald...');
    setGpsErrors([]);

    try {
      const position = await getBrowserLocation();
      const location = positionToLocation(position);
      const estimatedDistance = calculateStraightLineKm(
        gpsDraft.startLat,
        gpsDraft.startLng,
        location.lat,
        location.lng,
      );
      setGpsDraft((current) => {
        return {
          ...current,
          endTime: getCurrentTime(),
          endLat: location.lat,
          endLng: location.lng,
          endAccuracy: location.accuracy,
          calculatedKm: estimatedDistance,
          manualKm: estimatedDistance === '' ? current.manualKm : String(estimatedDistance),
          finalKm: estimatedDistance === '' ? current.finalKm : String(estimatedDistance),
        };
      });
      setGpsWarnings((current) => [
        ...current,
        ...(location.accuracy > 100
          ? [`Eindlocatie is onnauwkeurig: ongeveer ${location.accuracy} meter.`]
          : []),
        estimatedDistance === ''
          ? 'Vul de werkelijke routekilometers handmatig in.'
          : 'Controleer de hemelsbrede schatting en vul de werkelijke routekilometers in.',
      ]);
    } catch (error) {
      setGpsDraft((current) => ({
        ...current,
        endTime: getCurrentTime(),
      }));
      setGpsWarnings((current) => [...current, getLocationErrorMessage(error)]);
    } finally {
      setGpsBusy(false);
      setGpsMessage('Controleer de rit en sla daarna definitief op.');
      setGpsPhase('review');
    }
  }

  function cancelGpsTrip() {
    const shouldCancel =
      gpsPhase === 'idle' || window.confirm('GPS-rit annuleren? Niet-opgeslagen gegevens gaan verloren.');
    if (!shouldCancel) return;

    setGpsPhase('idle');
    setGpsDraft(createEmptyGpsDraft(data.settings));
    setGpsMessage('');
    setGpsWarnings([]);
    setGpsErrors([]);
  }

  function saveGpsTrip(event) {
    event.preventDefault();
    const { startAccuracy, endAccuracy, ...gpsTrip } = gpsDraft;
    const preparedTrip = {
      ...gpsTrip,
      userName: data.settings.userName,
      finalKm: gpsDraft.manualKm,
      manualKm: gpsDraft.manualKm,
      mileageRate: toNumber(gpsDraft.mileageRate, data.settings.defaultMileageRate),
      deductibleAmount: calculateDeductibleAmount(gpsDraft.manualKm, gpsDraft.mileageRate),
      updatedAt: getIsoTimestamp(),
    };
    const validation = validateTripForm(preparedTrip);
    setGpsErrors(validation.errors);
    setGpsWarnings((current) => [
      ...current.filter((warning) => !validation.warnings.includes(warning)),
      ...validation.warnings,
    ]);

    if (validation.errors.length > 0) {
      showNotice('Controleer de GPS-rit voordat je opslaat.');
      return;
    }

    const savedTrip = createTrip(preparedTrip, data.settings);
    setData((current) =>
      normalizeData({
        ...current,
        trips: [savedTrip, ...current.trips],
      }),
    );
    setGpsPhase('idle');
    setGpsDraft(createEmptyGpsDraft(data.settings));
    setGpsMessage('');
    setGpsWarnings([]);
    setGpsErrors([]);
    setActiveTab('ritten');
    showNotice(`GPS-rit opgeslagen als ${savedTrip.status}.`);
  }

  function startEditTrip(trip) {
    setTripForm(tripToForm(trip));
    setEditingTripId(trip.id);
    setSelectedTripId(null);
    setFormErrors([]);
    setSubmitWarnings([]);
    setActiveTab('nieuwe-rit');
  }

  function viewTrip(trip) {
    setSelectedTripId(trip.id);
    setActiveTab('ritten');
  }

  function deleteTrip(trip) {
    const confirmed = window.confirm(
      `Rit van ${formatDate(trip.date)} verwijderen? Dit kan niet ongedaan worden gemaakt.`,
    );
    if (!confirmed) return;

    setData((current) =>
      normalizeData({
        ...current,
        trips: current.trips.filter((currentTrip) => currentTrip.id !== trip.id),
      }),
    );
    if (selectedTripId === trip.id) setSelectedTripId(null);
    showNotice('Rit is verwijderd.');
  }

  function loadSamples() {
    const confirmed = window.confirm(
      'Voorbeelddata vervangt de huidige lokale gegevens. Doorgaan?',
    );
    if (!confirmed) return;

    const nextData = normalizeData(sampleData);
    setData(nextData);
    setSelectedTripId(null);
    setEditingTripId(null);
    setFormErrors([]);
    setSubmitWarnings([]);
    setTripForm(createEmptyTripForm(nextData.settings));
    showNotice('Voorbeelddata is geladen.');
  }

  function clearAllData() {
    const firstConfirm = window.confirm(
      'Alle lokale ritten en instellingen worden gewist. Weet je het zeker?',
    );
    if (!firstConfirm) return;

    const typed = window.prompt('Typ WISSEN om alle lokale data definitief te wissen.');
    if (typed !== 'WISSEN') {
      showNotice('Wissen is geannuleerd.');
      return;
    }

    clearLocalData();
    const freshData = loadLocalData();
    setData(freshData);
    setSelectedTripId(null);
    setTripForm(createEmptyTripForm(freshData.settings));
    showNotice('Alle lokale data is gewist.');
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateReportFilter(key, value) {
    setReportFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Lokale PWA</p>
          <h1>Zakelijke KM Logger</h1>
        </div>
        <span className="status-pill">Alleen lokaal</span>
      </header>

      {notice && <p className="notice">{notice}</p>}

      <nav className="tab-nav" aria-label="Hoofdnavigatie">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.id ? 'tab-button active' : 'tab-button'}
            key={tab.id}
            type="button"
            onClick={() => goToTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="content-panel">
        {activeTab === 'dashboard' && (
          <section>
            <div className="section-heading">
              <p className="eyebrow">Overzicht</p>
              <h2>Dashboard</h2>
            </div>

            <div className="dashboard-actions">
              <button className="primary-action" type="button" onClick={() => goToTab('nieuwe-rit')}>
                Nieuwe rit
              </button>
              <button className="secondary-action" type="button" onClick={() => goToTab('gps-rit')}>
                Start GPS-rit
              </button>
              <button className="secondary-action" type="button" onClick={() => goToTab('backup')}>
                Export maken
              </button>
            </div>

            <div className="metric-grid dashboard-grid">
              <article className="metric-card">
                <span>Zakelijke km deze maand</span>
                <strong>{dashboardStats.monthKm.toLocaleString('nl-NL')}</strong>
              </article>
              <article className="metric-card">
                <span>Zakelijke km dit kwartaal</span>
                <strong>{dashboardStats.quarterKm.toLocaleString('nl-NL')}</strong>
              </article>
              <article className="metric-card">
                <span>Zakelijke km dit jaar</span>
                <strong>{dashboardStats.yearKm.toLocaleString('nl-NL')}</strong>
              </article>
              <article className="metric-card">
                <span>Aftrekbaar dit jaar</span>
                <strong>{formatCurrency(dashboardStats.yearAmount, data.settings.currency)}</strong>
              </article>
              <article className="metric-card">
                <span>Ritten deze maand</span>
                <strong>{dashboardStats.monthTrips}</strong>
              </article>
              <article className="metric-card">
                <span>Incomplete ritten</span>
                <strong>{dashboardStats.incompleteTrips}</strong>
              </article>
            </div>

            <section className="subsection">
              <div className="subsection-heading">
                <h3>Laatste 5 ritten</h3>
                <button className="text-action" type="button" onClick={() => goToTab('ritten')}>
                  Alle ritten
                </button>
              </div>
              {dashboardStats.latestTrips.length === 0 ? (
                <p className="muted-text">Er zijn nog geen ritten opgeslagen.</p>
              ) : (
                <div className="trip-list compact-list">
                  {dashboardStats.latestTrips.map((trip) => (
                    <article className="trip-card" key={trip.id}>
                      <div>
                        <strong>{trip.purpose || 'Rit zonder doel'}</strong>
                        <span>{formatDate(trip.date)}</span>
                      </div>
                      <p>
                        {trip.startAddress || 'Start onbekend'} →{' '}
                        {trip.endAddress || 'eind onbekend'}
                      </p>
                      <footer>
                        <span>{trip.finalKm || 0} km</span>
                        <span className={`status-label ${trip.status}`}>{trip.status}</span>
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        )}

        {activeTab === 'nieuwe-rit' && (
          <section>
            <div className="section-heading">
              <p className="eyebrow">
                {editingTripId ? 'Bestaande rit aanpassen' : 'Handmatig invoeren'}
              </p>
              <h2>{editingTripId ? 'Rit bewerken' : 'Nieuwe rit'}</h2>
            </div>

            <TripForm
              currency={data.settings.currency}
              formErrors={formErrors}
              mode={editingTripId ? 'edit' : 'new'}
              onCancelEdit={resetTripForm}
              onReset={resetTripForm}
              onSubmit={saveTrip}
              onUpdate={updateTripForm}
              submitWarnings={submitWarnings}
              tripForm={tripForm}
            />
          </section>
        )}

        {activeTab === 'gps-rit' && (
          <section>
            <div className="section-heading">
              <p className="eyebrow">Handmatig starten en stoppen</p>
              <h2>GPS-rit</h2>
            </div>

            {gpsMessage && <p className="notice gps-notice">{gpsMessage}</p>}

            {gpsPhase === 'idle' && (
              <div className="gps-panel">
                <p className="muted-text">
                  GPS legt alleen start- en eindpunt vast. De app volgt je rit niet
                  op de achtergrond en gebruikt geen betaalde kaartendienst.
                </p>
                {gpsWarnings.map((warning, index) => (
                  <p className="form-warning" key={`${warning}-${index}`}>
                    {warning}
                  </p>
                ))}
                <button className="primary-action" type="button" onClick={startGpsTrip} disabled={gpsBusy}>
                  {gpsBusy ? 'Locatie ophalen...' : 'Start rit'}
                </button>
              </div>
            )}

            {gpsPhase === 'active' && (
              <div className="gps-panel">
                <div className="gps-summary">
                  <div>
                    <span>Starttijd</span>
                    <strong>{gpsDraft.startTime || '-'}</strong>
                    <p>{formatCoordinates(gpsDraft.startLat, gpsDraft.startLng)}</p>
                  </div>
                  <div>
                    <span>Startadres</span>
                    <strong>{gpsDraft.startAddress || 'Handmatig invullen'}</strong>
                    <p>
                      {gpsDraft.startAccuracy
                        ? `Nauwkeurigheid ongeveer ${gpsDraft.startAccuracy} meter`
                        : 'Geen GPS-nauwkeurigheid beschikbaar'}
                    </p>
                  </div>
                </div>
                {gpsWarnings.map((warning, index) => (
                  <p className="form-warning" key={`${warning}-${index}`}>
                    {warning}
                  </p>
                ))}
                <div className="form-actions">
                  <button className="primary-action" type="button" onClick={finishGpsTrip} disabled={gpsBusy}>
                    {gpsBusy ? 'Eindlocatie ophalen...' : 'Eindig rit'}
                  </button>
                  <button className="secondary-action" type="button" onClick={cancelGpsTrip}>
                    Annuleren
                  </button>
                </div>
              </div>
            )}

            {gpsPhase === 'review' && (
              <GpsReviewForm
                currency={data.settings.currency}
                gpsDraft={gpsDraft}
                gpsErrors={gpsErrors}
                gpsWarnings={gpsWarnings}
                onCancel={cancelGpsTrip}
                onSave={saveGpsTrip}
                onUpdate={updateGpsDraft}
              />
            )}
          </section>
        )}

        {activeTab === 'ritten' && (
          <section>
            <div className="section-heading">
              <p className="eyebrow">Lokale ritten</p>
              <h2>Ritten</h2>
            </div>

            {selectedTrip && (
              <article className="detail-panel">
                <div className="subsection-heading">
                  <h3>Rit bekijken</h3>
                  <button className="text-action" type="button" onClick={() => setSelectedTripId(null)}>
                    Sluiten
                  </button>
                </div>
                <dl className="detail-grid">
                  <div>
                    <dt>Datum</dt>
                    <dd>{formatDate(selectedTrip.date)}</dd>
                  </div>
                  <div>
                    <dt>Route</dt>
                    <dd>
                      {selectedTrip.startAddress || '-'} → {selectedTrip.endAddress || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt>Klant</dt>
                    <dd>{selectedTrip.customer || '-'}</dd>
                  </div>
                  <div>
                    <dt>Project</dt>
                    <dd>{selectedTrip.project || '-'}</dd>
                  </div>
                  <div>
                    <dt>Doel</dt>
                    <dd>{selectedTrip.purpose || '-'}</dd>
                  </div>
                  <div>
                    <dt>Kilometers</dt>
                    <dd>{selectedTrip.finalKm || 0} km</dd>
                  </div>
                  <div>
                    <dt>Bedrag</dt>
                    <dd>{formatCurrency(selectedTrip.deductibleAmount, data.settings.currency)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <span className={`status-label ${selectedTrip.status}`}>
                        {selectedTrip.status}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Notitie</dt>
                    <dd>{selectedTrip.note || '-'}</dd>
                  </div>
                </dl>
                <div className="card-actions">
                  <button className="secondary-action" type="button" onClick={() => startEditTrip(selectedTrip)}>
                    Bewerken
                  </button>
                  <button className="danger-action" type="button" onClick={() => deleteTrip(selectedTrip)}>
                    Verwijderen
                  </button>
                </div>
              </article>
            )}

            <div className="filters-panel">
              <label>
                Zoeken
                <input
                  value={filters.search}
                  onChange={(event) => updateFilter('search', event.target.value)}
                  placeholder="Zoek op adres, klant, project of doel"
                />
              </label>
              <div className="filters-grid">
                <label>
                  Jaar
                  <select value={filters.year} onChange={(event) => updateFilter('year', event.target.value)}>
                    <option value="alle">Alle jaren</option>
                    {filterOptions.years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Maand
                  <select value={filters.month} onChange={(event) => updateFilter('month', event.target.value)}>
                    <option value="alle">Alle maanden</option>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Kwartaal
                  <select value={filters.quarter} onChange={(event) => updateFilter('quarter', event.target.value)}>
                    <option value="alle">Alle kwartalen</option>
                    <option value="1">Q1</option>
                    <option value="2">Q2</option>
                    <option value="3">Q3</option>
                    <option value="4">Q4</option>
                  </select>
                </label>
                <label>
                  Klant
                  <select value={filters.customer} onChange={(event) => updateFilter('customer', event.target.value)}>
                    <option value="alle">Alle klanten</option>
                    {filterOptions.customers.map((customer) => (
                      <option key={customer} value={customer}>
                        {customer}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Type
                  <select value={filters.tripType} onChange={(event) => updateFilter('tripType', event.target.value)}>
                    <option value="alle">Alle types</option>
                    <option value="zakelijk">Zakelijk</option>
                    <option value="privé">Privé</option>
                  </select>
                </label>
                <label>
                  Status
                  <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
                    <option value="alle">Alle statussen</option>
                    <option value="compleet">Compleet</option>
                    <option value="incompleet">Incompleet</option>
                  </select>
                </label>
              </div>
              <button className="secondary-action" type="button" onClick={() => setFilters(emptyFilters)}>
                Filters wissen
              </button>
            </div>

            {filteredTrips.length === 0 ? (
              <p className="muted-text">Geen ritten gevonden met deze filters.</p>
            ) : (
              <div className="trip-list">
                {filteredTrips.map((trip) => (
                  <article className="trip-card rich-card" key={trip.id}>
                    <div>
                      <strong>{formatDate(trip.date)}</strong>
                      <span className={`status-label ${trip.status}`}>{trip.status}</span>
                    </div>
                    <p className="route-line">
                      {trip.startAddress || 'Start onbekend'} → {trip.endAddress || 'eind onbekend'}
                    </p>
                    <dl className="trip-card-grid">
                      <div>
                        <dt>Klant</dt>
                        <dd>{trip.customer || '-'}</dd>
                      </div>
                      <div>
                        <dt>Project</dt>
                        <dd>{trip.project || '-'}</dd>
                      </div>
                      <div>
                        <dt>Doel</dt>
                        <dd>{trip.purpose || '-'}</dd>
                      </div>
                      <div>
                        <dt>Kilometers</dt>
                        <dd>{trip.finalKm || 0} km</dd>
                      </div>
                      <div>
                        <dt>Bedrag</dt>
                        <dd>{formatCurrency(trip.deductibleAmount, data.settings.currency)}</dd>
                      </div>
                      <div>
                        <dt>Type</dt>
                        <dd>{trip.tripType}</dd>
                      </div>
                    </dl>
                    <div className="card-actions">
                      <button className="secondary-action" type="button" onClick={() => viewTrip(trip)}>
                        Bekijken
                      </button>
                      <button className="secondary-action" type="button" onClick={() => startEditTrip(trip)}>
                        Bewerken
                      </button>
                      <button className="danger-action" type="button" onClick={() => deleteTrip(trip)}>
                        Verwijderen
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'rapportage' && (
          <section>
            <div className="section-heading">
              <p className="eyebrow">Boekhouding</p>
              <h2>Rapportage</h2>
            </div>

            <div className="filters-panel report-filters">
              <div className="filters-grid">
                <label>
                  Jaar
                  <select
                    value={reportFilters.year}
                    onChange={(event) => updateReportFilter('year', event.target.value)}
                  >
                    <option value="alle">Alle jaren</option>
                    {filterOptions.years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Maand
                  <select
                    value={reportFilters.month}
                    onChange={(event) => updateReportFilter('month', event.target.value)}
                  >
                    <option value="alle">Alle maanden</option>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                      <option key={month} value={month}>
                        {getMonthLabel(month)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Kwartaal
                  <select
                    value={reportFilters.quarter}
                    onChange={(event) => updateReportFilter('quarter', event.target.value)}
                  >
                    <option value="alle">Alle kwartalen</option>
                    <option value="1">Q1</option>
                    <option value="2">Q2</option>
                    <option value="3">Q3</option>
                    <option value="4">Q4</option>
                  </select>
                </label>
                <label>
                  Klant
                  <select
                    value={reportFilters.customer}
                    onChange={(event) => updateReportFilter('customer', event.target.value)}
                  >
                    <option value="alle">Alle klanten</option>
                    {filterOptions.customers.map((customer) => (
                      <option key={customer} value={customer}>
                        {customer}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Project
                  <select
                    value={reportFilters.project}
                    onChange={(event) => updateReportFilter('project', event.target.value)}
                  >
                    <option value="alle">Alle projecten</option>
                    {filterOptions.projects.map((project) => (
                      <option key={project} value={project}>
                        {project}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className="secondary-action"
                type="button"
                onClick={() => setReportFilters(emptyReportFilters)}
              >
                Rapportfilters wissen
              </button>
            </div>

            <div className="metric-grid dashboard-grid">
              <article className="metric-card">
                <span>Gefilterde ritten</span>
                <strong>{reportData.filteredCount}</strong>
              </article>
              <article className="metric-card">
                <span>Ritten die meetellen</span>
                <strong>{reportData.countedCount}</strong>
              </article>
              <article className="metric-card">
                <span>Zakelijke km aftrekbaar</span>
                <strong>{reportData.countedKm.toLocaleString('nl-NL')}</strong>
              </article>
              <article className="metric-card">
                <span>Aftrekbaar bedrag</span>
                <strong>{formatCurrency(reportData.countedAmount, data.settings.currency)}</strong>
              </article>
            </div>

            <p className="report-note">
              Alleen complete zakelijke ritten tellen mee voor zakelijke kilometers en
              aftrekbare bedragen. Privéritten en incomplete ritten blijven zichtbaar,
              maar tellen niet mee voor aftrek.
            </p>

            {reportData.incompleteTrips.length > 0 && (
              <section className="report-warning">
                <h3>Incomplete ritten</h3>
                <p>
                  {reportData.incompleteTrips.length} ritten zijn incompleet en tellen
                  niet mee zolang verplichte gegevens ontbreken.
                </p>
              </section>
            )}

            <div className="report-grid">
              <ReportTable
                currency={data.settings.currency}
                rows={reportData.monthRows}
                title="Per maand"
              />
              <ReportTable
                currency={data.settings.currency}
                rows={reportData.quarterRows}
                title="Per kwartaal"
              />
              <ReportTable
                currency={data.settings.currency}
                rows={reportData.yearRows}
                title="Per jaar"
              />
              <ReportTable
                currency={data.settings.currency}
                rows={reportData.customerRows}
                title="Per klant"
              />
              <ReportTable
                currency={data.settings.currency}
                rows={reportData.projectRows}
                title="Per project"
              />
              <ReportTable
                currency={data.settings.currency}
                rows={reportData.typeRows}
                title="Per type rit"
              />
            </div>

            <section className="report-card">
              <h3>Ritten die niet meetellen</h3>
              {reportData.excludedTrips.length === 0 ? (
                <p className="muted-text">Geen uitgesloten ritten binnen deze filters.</p>
              ) : (
                <div className="table-wrap">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Datum</th>
                        <th>Rit</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Reden</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.excludedTrips.map((trip) => (
                        <tr key={trip.id}>
                          <td>{formatDate(trip.date)}</td>
                          <td>{trip.purpose || trip.customer || 'Rit zonder omschrijving'}</td>
                          <td>{trip.tripType}</td>
                          <td>{trip.status}</td>
                          <td>{getExclusionReason(trip)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </section>
        )}

        {activeTab === 'backup' && (
          <section>
            <div className="section-heading">
              <p className="eyebrow">Eigen beheer</p>
              <h2>Backup/export</h2>
            </div>

            <div className="filters-panel backup-panel">
              <div className="filters-grid">
                <label>
                  Periode
                  <select
                    value={backupPeriod.type}
                    onChange={(event) =>
                      setBackupPeriod((current) => ({
                        ...current,
                        type: event.target.value,
                      }))
                    }
                  >
                    <option value="month">Maand</option>
                    <option value="quarter">Kwartaal</option>
                    <option value="year">Jaar</option>
                    <option value="all">Alles</option>
                  </select>
                </label>
                {backupPeriod.type !== 'all' && (
                  <label>
                    Jaar
                    <select
                      value={backupPeriod.year}
                      onChange={(event) =>
                        setBackupPeriod((current) => ({
                          ...current,
                          year: event.target.value,
                        }))
                      }
                    >
                      {[...new Set([new Date().getFullYear(), ...filterOptions.years])]
                        .sort((a, b) => b - a)
                        .map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {backupPeriod.type === 'month' && (
                  <label>
                    Maand
                    <select
                      value={backupPeriod.month}
                      onChange={(event) =>
                        setBackupPeriod((current) => ({
                          ...current,
                          month: event.target.value,
                        }))
                      }
                    >
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                        <option key={month} value={month}>
                          {getMonthLabel(month)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {backupPeriod.type === 'quarter' && (
                  <label>
                    Kwartaal
                    <select
                      value={backupPeriod.quarter}
                      onChange={(event) =>
                        setBackupPeriod((current) => ({
                          ...current,
                          quarter: event.target.value,
                        }))
                      }
                    >
                      <option value="1">Q1</option>
                      <option value="2">Q2</option>
                      <option value="3">Q3</option>
                      <option value="4">Q4</option>
                    </select>
                  </label>
                )}
              </div>
              <p className="muted-text">
                Gekozen periode: {backupRange.label}. Aantal ritten in export:{' '}
                {backupTrips.length}.
              </p>
            </div>

            <div className="action-list backup-actions">
              <button className="primary-action" type="button" onClick={exportJson}>
                JSON-backup maken
              </button>
              <button className="secondary-action" type="button" onClick={exportCsv}>
                Ritten naar CSV exporteren
              </button>
              <button className="secondary-action" type="button" onClick={exportAccountantCsv}>
                Boekhouder-overzicht CSV
              </button>
              <button className="secondary-action" type="button" onClick={() => fileInputRef.current?.click()}>
                JSON-backup terugzetten
              </button>
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept="application/json,.json"
                onChange={restoreJson}
              />
            </div>

            {pendingImport && (
              <section className="import-panel">
                <h3>Import controleren</h3>
                <dl className="detail-grid">
                  <div>
                    <dt>Gebruiker</dt>
                    <dd>{pendingImport.summary.userName || '-'}</dd>
                  </div>
                  <div>
                    <dt>Ritten in bestand</dt>
                    <dd>{pendingImport.summary.trips}</dd>
                  </div>
                  <div>
                    <dt>Periode</dt>
                    <dd>
                      {pendingImport.summary.from || '-'} tot{' '}
                      {pendingImport.summary.to || '-'}
                    </dd>
                  </div>
                  <div>
                    <dt>Mogelijke dubbele ritten</dt>
                    <dd>{pendingImport.summary.duplicateCount}</dd>
                  </div>
                </dl>
                <p className="form-warning">
                  Kies pas na controle. Bij toevoegen worden ritten met hetzelfde id
                  overgeslagen.
                </p>
                <div className="form-actions">
                  <button className="danger-action" type="button" onClick={() => confirmImport('replace')}>
                    Bestaande data vervangen
                  </button>
                  <button className="primary-action" type="button" onClick={() => confirmImport('add')}>
                    Import toevoegen
                  </button>
                  <button className="secondary-action" type="button" onClick={() => setPendingImport(null)}>
                    Annuleren
                  </button>
                </div>
              </section>
            )}
          </section>
        )}

        {activeTab === 'instellingen' && (
          <section>
            <div className="section-heading">
              <p className="eyebrow">Voorkeuren</p>
              <h2>Instellingen</h2>
            </div>
            <div className="settings-form">
              <label>
                Naam gebruiker
                <input
                  value={data.settings.userName}
                  onChange={(event) => updateSetting('userName', event.target.value)}
                  placeholder="Naam"
                />
              </label>
              <label>
                Standaard voertuig
                <input
                  value={data.settings.vehicle}
                  onChange={(event) => updateSetting('vehicle', event.target.value)}
                  placeholder="Privéauto"
                />
              </label>
              <label>
                Kenteken optioneel
                <input
                  value={data.settings.licensePlate}
                  onChange={(event) => updateSetting('licensePlate', event.target.value)}
                  placeholder="Bijv. AB-123-C"
                />
              </label>
              <label>
                Standaard startadres
                <input
                  value={data.settings.defaultStartAddress}
                  onChange={(event) => updateSetting('defaultStartAddress', event.target.value)}
                  placeholder="Thuisadres of kantoor"
                />
              </label>
              <label>
                Standaard kilometertarief
                <input
                  inputMode="decimal"
                  value={data.settings.defaultMileageRate}
                  onChange={(event) => updateSetting('defaultMileageRate', event.target.value)}
                  placeholder="0.23"
                />
              </label>
              <label>
                Valuta
                <select
                  value={data.settings.currency}
                  onChange={(event) => updateSetting('currency', event.target.value)}
                >
                  <option value="EUR">EUR</option>
                </select>
              </label>
            </div>

            <div className="settings-actions">
              <button className="primary-action" type="button" onClick={saveSettings}>
                Instellingen opslaan
              </button>
              <button className="secondary-action" type="button" onClick={loadSamples}>
                Voorbeelddata laden
              </button>
              <button className="danger-action" type="button" onClick={clearAllData}>
                Alle lokale data wissen
              </button>
            </div>
            <p className="app-version">App-versie {APP_VERSION}</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
