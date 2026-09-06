import { Injectable } from '@nestjs/common';
import { NotificationAudience, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async notify(
    profileId: string,
    audience: NotificationAudience,
    type: NotificationType,
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
  ) {
    const userId = await this.resolveUserId(profileId, audience);
    if (!userId) return null;
    return this.prisma.notification.create({
      data: { userId, audience, type, title, body, metadata: metadata as any },
    });
  }

  async notifyMany(
    profileIds: string[],
    audience: NotificationAudience,
    type: NotificationType,
    title: string,
    body: string,
    metadata?: Record<string, unknown>,
  ) {
    const userIds = await this.resolveUserIds(profileIds, audience);
    if (!userIds.length) return { count: 0 };
    return this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, audience, type, title, body, metadata: metadata as any })),
    });
  }

  private async resolveUserId(profileId: string, audience: NotificationAudience) {
    if (audience === 'STUDENT') {
      const s = await this.prisma.student.findUnique({ where: { id: profileId } });
      return s?.userId ?? null;
    }
    if (audience === 'FACULTY') {
      const f = await this.prisma.faculty.findUnique({ where: { id: profileId } });
      return f?.userId ?? null;
    }
    const a = await this.prisma.admin.findUnique({ where: { id: profileId } });
    return a?.userId ?? null;
  }

  private async resolveUserIds(profileIds: string[], audience: NotificationAudience) {
    if (audience === 'STUDENT') {
      const rows = await this.prisma.student.findMany({ where: { id: { in: profileIds } }, select: { userId: true } });
      return rows.map((r) => r.userId);
    }
    if (audience === 'FACULTY') {
      const rows = await this.prisma.faculty.findMany({ where: { id: { in: profileIds } }, select: { userId: true } });
      return rows.map((r) => r.userId);
    }
    const rows = await this.prisma.admin.findMany({ where: { id: { in: profileIds } }, select: { userId: true } });
    return rows.map((r) => r.userId);
  }

  async listForUser(userId: string, unreadOnly?: boolean) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }
}
