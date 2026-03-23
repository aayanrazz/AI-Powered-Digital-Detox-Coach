export const formatMinutes = (minutes?: number) => {
  if (!minutes) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
};

export const formatDateTime = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleString();
};

export const progressPercent = (done: number, total: number) => {
  if (!total) return 0;
  return Math.min(100, Math.round((done / total) * 100));
};