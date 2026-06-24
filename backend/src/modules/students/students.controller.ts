import { Request, Response } from 'express';
import { studentsService } from './students.service';
import { asyncHandler } from '../../common/asyncHandler';
import { success, created } from '../../common/apiResponse';
import { getPageParams } from '../../common/pagination';
import { writeAudit } from '../../common/audit';
import { sendExcel, parseExcel } from '../../common/excel';
import { ApiError } from '../../common/ApiError';
import { prisma } from '../../config/prisma';

export const studentsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    // ?all=true returns the full list (for dropdowns/selects) without pagination.
    if (req.query.all === 'true') {
      const items = await studentsService.findAll(status);
      return success(res, items);
    }
    const params = getPageParams(req);
    const { items, meta } = await studentsService.list(params, status);
    return success(res, items, 'Berhasil', 200, meta);
  }),

  alumni: asyncHandler(async (req: Request, res: Response) => {
    const params = getPageParams(req);
    const { items, meta } = await studentsService.listAlumni(params);
    return success(res, items, 'Daftar alumni', 200, meta);
  }),

  detail: asyncHandler(async (req: Request, res: Response) => {
    const item = await studentsService.getById(req.params.id);
    return success(res, item);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const item = await studentsService.create(req.body, req.user!.id);
    await writeAudit({ req, action: 'CREATE', module: 'students', entityId: item.id });
    return created(res, item, 'Siswa berhasil ditambahkan');
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const item = await studentsService.update(req.params.id, req.body, req.user!.id);
    await writeAudit({ req, action: 'UPDATE', module: 'students', entityId: item.id });
    return success(res, item, 'Data siswa diperbarui');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await studentsService.remove(req.params.id, req.user!.id);
    await writeAudit({ req, action: 'DELETE', module: 'students', entityId: req.params.id });
    return success(res, null, 'Siswa berhasil dihapus');
  }),

  bulkPromote: asyncHandler(async (req: Request, res: Response) => {
    const { studentIds, targetClassId } = req.body;
    const result = await studentsService.bulkPromote(studentIds, targetClassId, req.user!.id);
    await writeAudit({ req, action: 'BULK_PROMOTE', module: 'students', detail: JSON.stringify(result) });
    return success(res, result, 'Kenaikan kelas berhasil');
  }),

  graduate: asyncHandler(async (req: Request, res: Response) => {
    const { studentIds } = req.body;
    const result = await studentsService.graduate(studentIds, req.user!.id);
    await writeAudit({ req, action: 'GRADUATE', module: 'students', detail: JSON.stringify(result) });
    return success(res, result, 'Siswa berhasil diluluskan menjadi alumni');
  }),

  // GET /students/export?status=AKTIF
  export: asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    const students = await prisma.student.findMany({ where, orderBy: { fullName: 'asc' } });

    const rows = students.map((st) => ({
      nis: st.nis ?? '',
      nisn: st.nisn ?? '',
      fullName: st.fullName,
      gender: st.gender,
      birthPlace: st.birthPlace ?? '',
      birthDate: st.birthDate ? st.birthDate.toISOString().slice(0, 10) : '',
      address: st.address ?? '',
      phone: st.phone ?? '',
      status: st.status,
    }));

    await sendExcel(
      res,
      `data-siswa-${Date.now()}.xlsx`,
      [
        { header: 'NIS', key: 'nis' },
        { header: 'NISN', key: 'nisn' },
        { header: 'Nama Lengkap', key: 'fullName', width: 30 },
        { header: 'JK', key: 'gender' },
        { header: 'Tempat Lahir', key: 'birthPlace' },
        { header: 'Tanggal Lahir', key: 'birthDate' },
        { header: 'Alamat', key: 'address', width: 35 },
        { header: 'Telepon', key: 'phone' },
        { header: 'Status', key: 'status' },
      ],
      rows,
      'Data Siswa',
    );
  }),

  // POST /students/import  (multipart file field: "file")
  import: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest('File tidak ditemukan (field "file")');
    const rows = await parseExcel(req.file.buffer);

    const results = { created: 0, failed: 0, errors: [] as string[] };
    for (const [i, row] of rows.entries()) {
      try {
        const fullName = String(row['Nama Lengkap'] ?? row['fullName'] ?? '').trim();
        if (!fullName) throw new Error('Nama Lengkap kosong');
        const genderRaw = String(row['JK'] ?? row['gender'] ?? '').toUpperCase();
        const gender = genderRaw.startsWith('P') ? 'PEREMPUAN' : 'LAKI_LAKI';
        await prisma.student.create({
          data: {
            nis: row['NIS'] ? String(row['NIS']) : null,
            nisn: row['NISN'] ? String(row['NISN']) : null,
            fullName,
            gender,
            birthPlace: row['Tempat Lahir'] ? String(row['Tempat Lahir']) : null,
            address: row['Alamat'] ? String(row['Alamat']) : null,
            phone: row['Telepon'] ? String(row['Telepon']) : null,
            status: 'AKTIF',
            createdBy: req.user!.id,
          },
        });
        results.created += 1;
      } catch (err) {
        results.failed += 1;
        results.errors.push(`Baris ${i + 2}: ${(err as Error).message}`);
      }
    }
    await writeAudit({ req, action: 'IMPORT', module: 'students', detail: `created=${results.created}, failed=${results.failed}` });
    return success(res, results, 'Import selesai');
  }),
};
