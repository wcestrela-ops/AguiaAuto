import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const correlationId = randomUUID();

    if (exception instanceof HttpException) {
      const status = exception.getResponse();
      const body = typeof status === 'object' ? (status as Record<string, unknown>) : { message: status };
      response.status(exception.getStatus()).json({
        success: false,
        error: {
          code: body.error || 'HTTP_ERROR',
          message: Array.isArray(body.message) ? body.message.join(', ') : body.message || exception.message,
          details: body.details || null,
          correlation_id: correlationId,
        },
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor.',
        details: null,
        correlation_id: correlationId,
      },
    });
  }
}
