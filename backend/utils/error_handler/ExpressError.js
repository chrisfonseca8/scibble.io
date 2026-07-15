class ExpressError extends Error {
    constructor(message, status = 500) {
        super(message);

        this.name = "ExpressError";
        this.status = status;

        Error.captureStackTrace(this, this.constructor);
    }
}

export default ExpressError;