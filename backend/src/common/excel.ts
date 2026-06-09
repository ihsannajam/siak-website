import ExcelJS from 'exceljs';
import { Response } from 'express';

export interface ColumnDef {
  header: string;
  key: string;
  width?: number;
}

/** Streams an .xlsx file to the client. */
export async function sendExcel(
  res: Response,
  fileName: string,
  columns: ColumnDef[],
  rows: Record<string, unknown>[],
  sheetName = 'Sheet1',
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  await wb.xlsx.write(res);
  res.end();
}

/** Reads rows from an uploaded .xlsx/.csv buffer into plain objects keyed by header. */
export async function parseExcel(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const wb = new ExcelJS.Workbook();
  // exceljs typings expect a strict Buffer; cast keeps it simple & safe here.
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    headers[col] = String(cell.value ?? '').trim();
  });

  const rows: Record<string, unknown>[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    row.eachCell((cell, col) => {
      const key = headers[col];
      if (key) obj[key] = cell.value;
    });
    if (Object.keys(obj).length) rows.push(obj);
  });
  return rows;
}
