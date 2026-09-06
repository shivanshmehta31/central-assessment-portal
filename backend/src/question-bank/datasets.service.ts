import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'datasets');

@Injectable()
export class DatasetsService {
  constructor(private prisma: PrismaService) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  list() {
    return this.prisma.dataset.findMany({ orderBy: { uploadedAt: 'desc' } });
  }

  async upload(file: Express.Multer.File) {
    const ext = path.extname(file.originalname).toLowerCase();
    const format = ext.replace('.', '') || 'csv';
    const filename = `${Date.now()}-${file.originalname}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, file.buffer);

    let previewRows: Record<string, any>[] = [];
    if (format === 'csv') {
      previewRows = (parse(file.buffer, { columns: true, skip_empty_lines: true, trim: true }) as any[]).slice(0, 20);
    } else if (format === 'xlsx' || format === 'xls') {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer as any);
      const sheet = workbook.worksheets[0];
      const headers = (sheet.getRow(1).values as any[]).slice(1).map((h) => String(h ?? ''));
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1 || previewRows.length >= 20) return;
        const values = (row.values as any[]).slice(1);
        const record: Record<string, any> = {};
        headers.forEach((h, idx) => (record[h] = values[idx]));
        previewRows.push(record);
      });
    } else if (format === 'json') {
      const parsed = JSON.parse(file.buffer.toString('utf-8'));
      previewRows = Array.isArray(parsed) ? parsed.slice(0, 20) : [parsed];
    }

    const columnCount = previewRows.length ? Object.keys(previewRows[0]).length : 0;

    return this.prisma.dataset.create({
      data: {
        name: file.originalname,
        fileUrl: `/uploads/datasets/${filename}`,
        format,
        previewJson: previewRows as any,
        columnCount,
      },
    });
  }
}
