import type { Request, Response } from "express";
import type { AppServerI, AuthServiceI, JWTPayload, Result } from "./types.js";
import { User } from "./entity/User.js";
import jwt from 'jsonwebtoken';

type RegisterRequest = {
    username: string;
    email: string;
    password: string;
    grade: string;
    className: string;
    minecraftId: string;
}

export class AuthService implements AuthServiceI {

    private appServer: AppServerI;
    constructor(appServer: AppServerI) {
        this.appServer = appServer;
        this.appServer.getExpress().post('/api/auth/register', (req: Request, res: Response) => {
            this.registerHandler.call(this, req, res)
        });
    }

    private registerHandler(req: Request, res: Response) {
        let body: RegisterRequest;
        try {
            body = req.body as RegisterRequest;
            if (body.className && body.email && body.grade && body.minecraftId && body.password && body.username) {
                body.className = body.className.trim();
                body.email = body.email.trim();
                body.grade = body.grade.trim();
                body.minecraftId = body.minecraftId.trim();
                body.username = body.username.trim();
                if (body.username.length > 255 || body.className.length > 255 || body.email.length > 255 || body.grade.length > 255 || body.minecraftId.length >= 16) {
                    res.statusCode = 400;
                    res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: {}, traceId: "" });
                    return;
                }
            }
            else {
                res.statusCode = 400;
                res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: {}, traceId: "" });
                return;
            }
        } catch (err) {
            res.statusCode = 400;
            res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: { error: err }, traceId: "" });
            return;
        }
        //TODO email verify
        try {
            this.appServer.getDatabase().query(User, { where: [{ username: body.username }] }).then((result) => {
                if (result.success) {
                    if (result.data && result.data.length > 0) {
                        res.statusCode = 409;
                        res.json({ code: "USERNAME_ALREADY_EXISTS", message: "用户名已存在", data: {}, traceId: "todo" });
                        return;
                    }
                    else {
                        this.appServer.getDatabase().query(User, { where: [{ email: body.email }] }).then((result) => {
                            if (result.success) {
                                if (result.data && result.data.length > 0) {
                                    res.statusCode = 409;
                                    res.json({ code: "EMAIL_ALREADY_USED", message: "邮箱已被占用", data: {}, traceId: "todo" });
                                    return;
                                }
                                else {
                                    this.appServer.getDatabase().createQueryBuilder(User, "user").insert().into("User").values({
                                        username: body.username,
                                        email: body.email,
                                        password: body.password,
                                        grade: body.grade,
                                        className: body.className,
                                        minecraftId: body.minecraftId
                                    }).execute().then(() => {
                                        this.appServer.getDatabase().query(User, { where: [{ email: body.email }] }).then((result) => {
                                            res.statusCode = 200;
                                            res.json({ code: "SUCCESS", message: "注册成功", data: { token: jwt.sign({ id: result.data[0].id }, this.appServer.getConfig().secretKey) }, traceId: "todo" });
                                        })
                                        return;
                                    }).catch((error) => {
                                        this.appServer.getLogger().error(`Failed to register user: ${error}`);
                                        res.statusCode = 500;
                                        res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId: "todo" });
                                        return;
                                    });
                                }
                            }
                            else {
                                this.appServer.getLogger().error(`Failed to register user: ${result.message}`);
                                res.statusCode = 500;
                                res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId: "todo" });
                                return;
                            }
                        });
                    }
                }
                else {
                    this.appServer.getLogger().error(`Failed to register user: ${result.message}`);
                    res.statusCode = 500;
                    res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId: "todo" });
                    return;
                }
            });
        } catch (err) {
            this.appServer.getLogger().error(`Failed to register user: ${err}`);
            res.statusCode = 500;
            res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId: "todo" });
            return;
        }
    }

    public getJWTPayload(token: string): Result<JWTPayload> {
        jwt.verify(token, this.appServer.getConfig().secretKey, (err, decoded) => {
            if (err) {
                return { success: false, message: `Invalid token: ${err}` };
            }
            else {
                return { success: true, message: "Success", data: decoded as JWTPayload };
            }
        });
        return { success: false, message: "Invalid token" };
    }
}