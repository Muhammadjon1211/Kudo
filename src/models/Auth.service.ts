import jwt from "jsonwebtoken";
import Errors, { HttpCode, Message } from "../libs/Errors";
import { AUTH_TIMER } from "../libs/config";
import { Member } from "../libs/types/member";

class AuthService {
    private readonly secretToken;

    constructor() {
        this.secretToken = process.env.SECRET_TOKEN as string;
    }

    public async createToken(payload: Member): Promise<string> {
        return new Promise((resolve, reject) => {
            const duration = `${AUTH_TIMER}h`;
            jwt.sign(
                payload as object,
                this.secretToken,
                { expiresIn: duration },
                (err, token) => {
                    if (err)
                        reject(
                            new Errors(
                                HttpCode.UNAUTHORIZED,
                                Message.TOKEN_CREATION_FAILED
                            )
                        );
                    else resolve(token as string);
                }
            );
        });
    }

    public async checkAuth(token: string): Promise<Member> {
        return new Promise((resolve, reject) => {
            jwt.verify(token, this.secretToken, (err, payload) => {
                if (err)
                    reject(
                        new Errors(
                            HttpCode.UNAUTHORIZED,
                            Message.NOT_AUTHENTICATED
                        )
                    );
                else resolve(payload as Member);
            });
        });
    }
}

export default AuthService;
