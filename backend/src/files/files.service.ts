import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { detectFileKind, FileKind, MAX_UPLOAD_BYTES, MIME_BY_KIND, safeFilename } from './file-type.util';

@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  // Validates and stores an uploaded document. `allowed` restricts which kinds are accepted.
  async save(file: Express.Multer.File | undefined, allowed: FileKind[], uploadedById?: string) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > MAX_UPLOAD_BYTES) throw new BadRequestException('File is larger than the 10 MB limit');

    const kind = detectFileKind(file.buffer, file.originalname);
    if (!kind || !allowed.includes(kind)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: ${allowed.map((k) => k.toUpperCase()).join(', ')}`,
      );
    }

    const stored = await this.prisma.storedFile.create({
      data: {
        filename: safeFilename(file.originalname),
        mimeType: MIME_BY_KIND[kind],
        size: file.size,
        data: file.buffer,
        uploadedById,
      },
      select: { id: true, filename: true, mimeType: true, size: true },
    });
    return { ...stored, kind };
  }

  async remove(fileId: string | null | undefined) {
    if (!fileId) return;
    await this.prisma.storedFile.deleteMany({ where: { id: fileId } });
  }

  async meta(fileId: string) {
    const meta = await this.prisma.storedFile.findUnique({
      where: { id: fileId },
      select: { id: true, filename: true, mimeType: true, size: true },
    });
    if (!meta) throw new NotFoundException('File not found');
    return meta;
  }

  // Staff may read a file only if it belongs to a paper-based assessment they can access.
  async assertCanRead(user: AuthUser, fileId: string) {
    if (user.role === 'ADMIN') return;
    if (user.role !== 'FACULTY') throw new NotFoundException('File not found');

    const linked = await this.prisma.assessment.findFirst({
      where: {
        evaluators: { some: { facultyId: user.profileId } },
        OR: [{ questionPaperFileId: fileId }, { attempts: { some: { answerSheetFileId: fileId } } }],
      },
      select: { id: true },
    });
    if (!linked) throw new NotFoundException('File not found');
  }

  async read(fileId: string) {
    const file = await this.prisma.storedFile.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }
}
