export function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function getCurrentTime() {
  return new Date().toTimeString().slice(0, 5);
}

export function getIsoTimestamp() {
  return new Date().toISOString();
}

export function formatDate(date) {
  if (!date) return 'Geen datum';

  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '';

  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}
