/**
 * Standard application error. Thrown anywhere in the stack and translated into a
 * consistent JSON response by the global error handler.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message = 'Permintaan tidak valid', details?: unknown) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = 'Tidak terautentikasi') {
    return new ApiError(401, message);
  }
  static forbidden(message = 'Anda tidak memiliki akses') {
    return new ApiError(403, message);
  }
  static notFound(message = 'Data tidak ditemukan') {
    return new ApiError(404, message);
  }
  static conflict(message = 'Data sudah ada / konflik') {
    return new ApiError(409, message);
  }
  static unprocessable(message = 'Aturan bisnis dilanggar', details?: unknown) {
    return new ApiError(422, message, details);
  }
  static internal(message = 'Terjadi kesalahan pada server') {
    return new ApiError(500, message);
  }
}
