import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

// "facultyCode" -> "faculty code"
const humanize = (field: string) => field.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

// Turns known database errors into messages an admin can act on, instead of
// leaking Prisma internals (query text, file paths) to the client.
function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): { status: number; message: string } | null {
  switch (err.code) {
    case 'P2002': {
      const target = err.meta?.target;
      const fields = (Array.isArray(target) ? target : typeof target === 'string' ? [target] : []).map(humanize);
      return {
        status: HttpStatus.CONFLICT,
        message: fields.length ? `Another record already uses this ${fields.join(' / ')}` : 'This record already exists',
      };
    }
    case 'P2003':
      return {
        status: HttpStatus.BAD_REQUEST,
        message: "A selected item doesn't exist, or this record is still in use by other data",
      };
    case 'P2025':
      return { status: HttpStatus.NOT_FOUND, message: 'Record not found' };
    default:
      return null;
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      message =
        typeof payload === 'string' ? payload : ((payload as any)?.message ?? exception.message);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = mapPrismaError(exception);
      if (mapped) ({ status, message } = mapped);
    }

    if (status >= 500) {
      // Full detail stays in the server log only.
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
