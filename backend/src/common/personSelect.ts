/**
 * Ringkasan orang untuk relasi di respons API. Jangan pakai `student: true` atau
 * `employee: true`, karena NIK, rekening, dan data pribadi lain akan ikut terkirim.
 */
export const studentSummary = {
  select: { id: true, nis: true, nisn: true, fullName: true, gender: true, status: true },
} as const;

export const employeeSummary = {
  select: { id: true, nip: true, fullName: true, position: true },
} as const;
