export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode?: number | string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ERR_MSG = {
  unexpected_error:
    'An unexpected error has occurred while processing :resource. Please try again in a few minutes. Thank you!',
};
