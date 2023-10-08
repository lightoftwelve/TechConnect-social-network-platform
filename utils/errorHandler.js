function errorHandler(err, req, res, next) {
  // Determine the error status code
  const statusCode = err.statusCode || 500; // Default to 500 if no status code is provided

  // Set the response status code
  res.status(statusCode);

  // Send an error response to the client
  res.json({
    error: {
      message: err.message || "Internal Server Error",
    },
  });
}

module.exports = errorHandler;
