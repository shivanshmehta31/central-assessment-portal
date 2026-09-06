import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private auditLogs: AuditLogsService,
  ) {}

  async get() {
    return this.prisma.systemSetting.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });
  }

  async update(data: Record<string, unknown>, actorId: string) {
    const updated = await this.prisma.systemSetting.upsert({
      where: { id: 'singleton' },
      update: data as any,
      create: { id: 'singleton', ...(data as any) },
    });
    await this.auditLogs.record({ userId: actorId, role: 'ADMIN', action: 'SETTINGS_UPDATED', entityType: 'SystemSetting', entityId: 'singleton' });
    return updated;
  }
}
