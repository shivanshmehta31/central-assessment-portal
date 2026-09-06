import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthUser } from '../common/decorators/current-user.decorator';

interface AuthedSocket extends Socket {
  data: { user?: AuthUser };
}

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'], credentials: true },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger('RealtimeGateway');

  constructor(private jwt: JwtService) {}

  handleConnection(client: AuthedSocket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      if (!token) throw new Error('missing token');
      const payload = this.jwt.verify(token as string, {
        secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      });
      client.data.user = payload;

      if (payload.role === 'STUDENT') {
        client.join(`student:${payload.profileId}`);
      } else {
        client.join(`staff:${payload.role}`);
      }
    } catch {
      this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect() {
    // no-op: room membership is cleaned up automatically by socket.io
  }

  @SubscribeMessage('join:assessment-monitor')
  joinAssessmentMonitor(client: AuthedSocket, assessmentId: string) {
    if (client.data.user?.role === 'STUDENT') return;
    client.join(`assessment-monitor:${assessmentId}`);
  }

  @SubscribeMessage('join:attempt')
  joinAttempt(client: AuthedSocket, attemptId: string) {
    if (client.data.user?.role !== 'STUDENT') return;
    client.join(`attempt:${attemptId}`);
  }

  // ── Server-initiated broadcasts ──────────────────────────────────────────

  broadcastAssessmentControl(assessmentId: string, payload: Record<string, unknown>) {
    this.server.to(`assessment-monitor:${assessmentId}`).emit('assessment:control', payload);
    this.server.to(`staff:ADMIN`).emit('assessment:control', { assessmentId, ...payload });
  }

  broadcastLiveStats(assessmentId: string, stats: Record<string, unknown>) {
    this.server.to(`assessment-monitor:${assessmentId}`).emit('assessment:live-stats', { assessmentId, ...stats });
  }

  broadcastViolation(assessmentId: string, violation: Record<string, unknown>) {
    this.server.to(`assessment-monitor:${assessmentId}`).emit('violation:new', violation);
  }

  broadcastAttemptUpdate(assessmentId: string, attempt: Record<string, unknown>) {
    this.server.to(`assessment-monitor:${assessmentId}`).emit('attempt:update', attempt);
  }

  notifyStudentTimeExtended(studentId: string, attemptId: string, minutes: number) {
    this.server.to(`student:${studentId}`).emit('attempt:time-extended', { attemptId, minutes });
  }

  forceSubmitStudent(studentId: string, attemptId: string, reason: string) {
    this.server.to(`student:${studentId}`).emit('attempt:force-submit', { attemptId, reason });
  }

  notifyStudentAssessmentPaused(studentId: string, attemptId: string, paused: boolean) {
    this.server.to(`student:${studentId}`).emit('attempt:pause-state', { attemptId, paused });
  }
}
