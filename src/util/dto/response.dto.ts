import { ResponseStatus } from 'src/config/constants.config';

export class ResponseDto<T = any> {
  constructor(
    public message: string,
    public status: ResponseStatus,
    public data?: T,
    public error?: {
      cause: unknown;
      name: string;
      path: string;
      statusCode: number;
    },
  ) {}

  public static createSuccessResponse<T>(
    message: string,
    data?: T,
  ): ResponseDto<T> {
    return new ResponseDto<T>(message, ResponseStatus.SUCCESS, data);
  }

  public static createErrorResponse<T>(
    message: string,
    error?: {
      cause: unknown;
      name: string;
      path: string;
      statusCode: number;
    },
  ): ResponseDto<T> {
    return new ResponseDto<T>(message, ResponseStatus.ERROR, undefined, error);
  }
}
