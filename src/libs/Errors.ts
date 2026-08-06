export enum HttpCode {
    OK = 200,
    CREATED = 201,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    TOO_MANY_REQUESTS = 429,
    INTERNAL_SERVER_ERROR = 500,
}

export enum Message {
    SOMETHING_WENT_WRONG = "Something went wrong!",
    NO_DATA_FOUND = "No data is found!",
    CREATE_FAILED = "Create is failed!",
    UPDATE_FAILED = "Update is failed!",
    DELETE_FAILED = "Delete is failed!",
    BLOCKED_USER = "You have been blocked, contact the administrator!",
    NOT_AUTHENTICATED = "You are not authenticated, please login first!",
    TOKEN_CREATION_FAILED = "Token creation is failed!",
    INVALID_INPUT = "The provided input is invalid!",
    ROUTE_NOT_FOUND = "The requested route does not exist!",

    /** Member **/
    USED_NICK_PHONE = "You are inserting already used nick or phone!",
    NO_MEMBER_NICK = "No member with that nick!",
    WRONG_PASSWORD = "Wrong password, please try again!",
    NOT_ALLOWED_REQUEST = "You are not allowed to make this request!",

    /** Product **/
    PRODUCT_OUT_OF_STOCK = "The product does not have enough stock left!",
    SIZE_NOT_AVAILABLE = "The product is not sold in the chosen size!",
    NO_SIZES_CHOSEN = "Choose at least one size and its stock count!",

    /** Order **/
    EMPTY_ORDER = "An order must contain at least one item!",
    ORDER_CREATION_FAILED = "The order could not be created!",

    /** Admin panel **/
    INVALID_CSRF = "This form has expired, please reload the page and try again!",
    TOO_MANY_ATTEMPTS = "Too many login attempts, please wait and try again!",
    PASSWORD_TOO_SHORT = "The new password must be at least 8 characters!",
    SAME_PASSWORD = "The new password must differ from the current one!",
    NO_SUCH_IMAGE = "That image does not belong to this product!",
}

class Errors extends Error {
    public code: HttpCode;
    public message: Message;

    static standard = {
        code: HttpCode.INTERNAL_SERVER_ERROR,
        message: Message.SOMETHING_WENT_WRONG,
    };

    constructor(statusCode: HttpCode, statusMessage: Message) {
        super();
        this.code = statusCode;
        this.message = statusMessage;
    }
}

export default Errors;
