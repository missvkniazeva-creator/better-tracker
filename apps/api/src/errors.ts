/** An error the caller can fix. Fastify's error handler reads `statusCode`. */
export class BadRequest extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'BadRequest';
  }
}
