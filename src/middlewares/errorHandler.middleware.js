const errorHandler = (err, req, res, next) => {
    console.error(err); // Log the error for debugging purposes
    const status = err.statusCode  || 500;
    const message = err.message || "Internal Server Error";
    const details = err.details || [];

    res.status(status).json({ status, message, details });
};

export { errorHandler };