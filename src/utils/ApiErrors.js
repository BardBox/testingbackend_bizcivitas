class ApiErrors extends Error {
    constructor(
        statusCode, message = 'something went wrong!', errors = [], stacks='' 
    ) {
        super(message)
        this.statusCode = statusCode
        this.message = message
        this.errors = errors
        this.data = null
        this.success = 'false'

        if(stacks == ""){
            this.stack = Error.captureStackTrace(this, this.constructor);
        }else{
            this.stack = stacks;
        }
    }
}

export default ApiErrors;