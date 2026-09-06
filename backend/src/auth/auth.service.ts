import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private auditLogs: AuditLogsService,
  ) {}

  private async resolveUserByIdentifier(identifier: string) {
    const byEmail = await this.prisma.user.findUnique({
      where: { email: identifier.toLowerCase() },
      include: { admin: true, faculty: true, student: true },
    });
    if (byEmail) return byEmail;

    const student = await this.prisma.student.findFirst({
      where: {
        OR: [{ studentCode: identifier }, { enrollmentNumber: identifier }],
      },
      include: { user: { include: { admin: true, faculty: true, student: true } } },
    });
    return student?.user ?? null;
  }

  async login(
    identifier: string,
    password: string,
    expectedRole: 'ADMIN' | 'FACULTY' | 'STUDENT' | undefined,
    meta: { ip?: string; userAgent?: string },
  ) {
    const user = await this.resolveUserByIdentifier(identifier);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('This account has been deactivated. Contact the administrator.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (expectedRole && user.role !== expectedRole) {
      throw new ForbiddenException(`This account is not registered as ${expectedRole.toLowerCase()}`);
    }

    const profileId =
      user.role === 'ADMIN'
        ? user.admin?.id
        : user.role === 'FACULTY'
          ? user.faculty?.id
          : user.student?.id;

    if (!profileId) {
      throw new UnauthorizedException('Account profile is incomplete. Contact the administrator.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      profileId,
    });

    await this.auditLogs.record({
      userId: user.id,
      role: user.role,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profileId,
        mustResetPassword: user.mustResetPassword,
        name:
          user.admin?.name ?? user.faculty?.name ?? user.student?.name ?? user.email,
      },
    };
  }

  async issueTokens(authUser: AuthUser) {
    const accessToken = this.jwt.sign(authUser, { expiresIn: ACCESS_TOKEN_TTL });

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId: authUser.userId, tokenHash, expiresAt },
    });

    return { accessToken, refreshToken: rawRefreshToken, expiresIn: 15 * 60 };
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revoked: false },
      include: { user: { include: { admin: true, faculty: true, student: true } } },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    const user = stored.user;
    const profileId =
      user.role === 'ADMIN'
        ? user.admin?.id
        : user.role === 'FACULTY'
          ? user.faculty?.id
          : user.student?.id;

    if (!profileId || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is no longer active.');
    }

    return this.issueTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
      profileId,
    });
  }

  async logout(userId: string, rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash },
        data: { revoked: true },
      });
    }
    await this.auditLogs.record({ userId, action: 'USER_LOGOUT', entityType: 'User', entityId: userId });
    return { success: true };
  }

  async forgotPassword(identifier: string) {
    const user = await this.resolveUserByIdentifier(identifier);
    // Always respond success to avoid account enumeration.
    if (!user) return { success: true };

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // NOTE: integrate a transactional email provider in production.
    // For now the reset link is logged server-side so an admin can relay it.
    // eslint-disable-next-line no-console
    console.log(`[password-reset] ${user.email} token=${rawToken} (valid 30 min)`);

    return { success: true };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { gt: new Date() } },
    });
    if (!user) throw new BadRequestException('Reset link is invalid or has expired.');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        mustResetPassword: false,
      },
    });
    await this.prisma.refreshToken.updateMany({ where: { userId: user.id }, data: { revoked: true } });
    await this.auditLogs.record({ userId: user.id, action: 'PASSWORD_RESET', entityType: 'User', entityId: user.id });
    return { success: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect.');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustResetPassword: false },
    });
    await this.auditLogs.record({ userId, action: 'PASSWORD_CHANGED', entityType: 'User', entityId: userId });
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { admin: true, faculty: true, student: true },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      mustResetPassword: user.mustResetPassword,
      profile: user.admin ?? user.faculty ?? user.student,
    };
  }

  static async hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  }
}
