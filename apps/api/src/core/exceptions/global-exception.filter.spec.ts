import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Prisma } from '@kentslsc/database';
import { GlobalExceptionFilter } from './global-exception.filter.js';

function createMockHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/test', method: 'GET' })
    }),
    status,
    json
  };
}

describe('GlobalExceptionFilter', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns a safe 500 for unknown errors in production', () => {
    process.env.NODE_ENV = 'production';
    const filter = new GlobalExceptionFilter();
    const host = createMockHost() as any;

    filter.catch(new Error('secret'), host);

    expect(host.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(host.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error'
      })
    );
    expect(host.json.mock.calls[0][0]).not.toHaveProperty('detail');
  });

  it('includes detail for unknown errors outside production', () => {
    process.env.NODE_ENV = 'development';
    const filter = new GlobalExceptionFilter();
    const host = createMockHost() as any;

    filter.catch(new Error('secret'), host);

    expect(host.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        detail: 'secret'
      })
    );
  });

  it('maps Prisma unique constraint violations to 409', () => {
    process.env.NODE_ENV = 'production';
    const filter = new GlobalExceptionFilter();
    const host = createMockHost() as any;
    const error = new Prisma.PrismaClientKnownRequestError('conflict', { code: 'P2002', clientVersion: 'test' });

    filter.catch(error, host);

    expect(host.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(host.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        code: 'P2002'
      })
    );
  });

  it('maps Prisma record-not-found to 404', () => {
    process.env.NODE_ENV = 'production';
    const filter = new GlobalExceptionFilter();
    const host = createMockHost() as any;
    const error = new Prisma.PrismaClientKnownRequestError('not found', { code: 'P2025', clientVersion: 'test' });

    filter.catch(error, host);

    expect(host.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
  });

  it('passes through NestJS HttpException status and message', () => {
    process.env.NODE_ENV = 'production';
    const filter = new GlobalExceptionFilter();
    const host = createMockHost() as any;

    filter.catch(new BadRequestException('invalid input'), host);

    expect(host.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(host.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'invalid input'
      })
    );
  });

  it('maps NestJS NotFoundException correctly', () => {
    process.env.NODE_ENV = 'production';
    const filter = new GlobalExceptionFilter();
    const host = createMockHost() as any;

    filter.catch(new NotFoundException('missing'), host);

    expect(host.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(host.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'missing'
      })
    );
  });
});
