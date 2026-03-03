
const errorHandler = (err, req, res, next) => {
  // 1. Generate a unique Error Reference ID
  const errorRef = `ERR-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  // 2. Log the full error details to the server console for the developer
  console.error(`[${errorRef}] Internal Server Error:`);
  console.error(err.stack || err);

  // 3. Determine Status Code
  const statusCode = err.status || 500;

  // 4. Send a sanitized, generic response to the user
  res.status(statusCode).json({
    success: false,
    message: "Could not process your request,kindly try again or contact support@aileana.com.",
  });
};

module.exports = errorHandler;