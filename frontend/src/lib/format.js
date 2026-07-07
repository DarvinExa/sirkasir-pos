export function rupiah(value) {
  const n = Number(value || 0);
  return 'Rp' + n.toLocaleString('id-ID');
}

export function formatDateTime(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function formatDate(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', { dateStyle: 'medium' });
  } catch {
    return iso;
  }
}
