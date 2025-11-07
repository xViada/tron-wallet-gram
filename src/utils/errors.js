class AppError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = options.userMessage || null;
    this.cause = options.cause;
  }
}

function asAppError(error, fallbackCode, fallbackUserMessage) {
  if (error instanceof AppError) return error;
  const message = error && error.message ? error.message : String(error);
  return new AppError(fallbackCode || 'UNEXPECTED_ERROR', message, {
    userMessage: fallbackUserMessage || 'An unexpected error occurred. Please try again.',
    cause: error,
  });
}

function toUserMessage(error, fallbackUserMessage) {
  if (error instanceof AppError && error.userMessage) return error.userMessage;
  return fallbackUserMessage || 'Something went wrong. Please try again.';
}

module.exports = { AppError, asAppError, toUserMessage };

