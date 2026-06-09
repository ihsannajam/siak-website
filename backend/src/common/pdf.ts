import PDFDocument from 'pdfkit';
import { Response } from 'express';

interface ReportCardPdfData {
  schoolName: string;
  studentName: string;
  nis?: string | null;
  className?: string | null;
  semester?: string | null;
  rows: { subject: string; type: string; score: number }[];
  average?: number | null;
  rank?: number | null;
  attitudeNote?: string | null;
  teacherNote?: string | null;
}

/** Streams a simple e-rapor PDF to the client. */
export function streamReportCardPdf(res: Response, data: ReportCardPdfData) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="rapor-${data.studentName}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).text(data.schoolName, { align: 'center' });
  doc.fontSize(13).text('LAPORAN HASIL BELAJAR (E-RAPOR)', { align: 'center' });
  doc.moveDown();

  doc.fontSize(10);
  doc.text(`Nama       : ${data.studentName}`);
  doc.text(`NIS        : ${data.nis ?? '-'}`);
  doc.text(`Kelas      : ${data.className ?? '-'}`);
  doc.text(`Semester   : ${data.semester ?? '-'}`);
  doc.moveDown();

  // table header
  const startX = 50;
  let y = doc.y;
  doc.font('Helvetica-Bold');
  doc.text('Mata Pelajaran', startX, y);
  doc.text('Jenis', startX + 240, y);
  doc.text('Nilai', startX + 360, y);
  doc.font('Helvetica');
  y += 18;
  doc.moveTo(startX, y - 4).lineTo(545, y - 4).stroke();

  for (const r of data.rows) {
    doc.text(r.subject, startX, y);
    doc.text(r.type, startX + 240, y);
    doc.text(String(r.score), startX + 360, y);
    y += 16;
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
  }

  doc.moveDown(2);
  doc.font('Helvetica-Bold').text(`Rata-rata : ${data.average ?? '-'}`, startX, y + 10);
  if (data.rank) doc.text(`Peringkat : ${data.rank}`);
  doc.font('Helvetica');
  doc.moveDown();
  if (data.attitudeNote) doc.text(`Catatan Sikap: ${data.attitudeNote}`);
  if (data.teacherNote) doc.text(`Catatan Wali Kelas: ${data.teacherNote}`);

  doc.end();
}
