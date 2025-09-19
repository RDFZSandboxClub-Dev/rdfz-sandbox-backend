import type { Request, Response } from "express";
import type { AppServerI, UserServiceI, JWTPayload, Result } from "./types.js";
import { User } from "./entity/User.js";
import jwt from 'jsonwebtoken';
import crypto from "crypto";

type RegisterRequest = {
    username: string;
    email: string;
    password: string;
    grade: string;
    className: string;
    minecraftId: string;
}

type ChangePasswordRequest = {
    oldPassword: string;
    newPassword: string;
}

type LoginRequest = {
    email: string;
    password: string;
}

export class UserService implements UserServiceI {

    private appServer: AppServerI;
    constructor(appServer: AppServerI) {
        this.appServer = appServer;
        this.appServer.getExpress().post('/api/auth/register', (req: Request, res: Response) => {
            this.registerHandler.call(this, req, res)
        });
        this.appServer.getExpress().post('/api/auth/login', (req: Request, res: Response) => {
            this.loginHandler.call(this, req, res);
        });
        this.appServer.getExpress().get('/api/auth/me', (req: Request, res: Response) => {
            this.userMeHandler.call(this, req, res);
        });
        this.appServer.getExpress().get('/api/users', (req: Request, res: Response) => {
            this.getUsersHandler.call(this, req, res);
        });
        this.appServer.getExpress().get('/api/users/:id', (req: Request, res: Response) => {
            this.getUserByIdHandler.call(this, req, res);
        });
        this.appServer.getExpress().put('/api/users/:id', (req: Request, res: Response) => {
            this.updateUserHandler.call(this, req, res);
        });
        this.appServer.getExpress().delete('/api/users/:id', (req: Request, res: Response) => {
            this.deleteUserHandler.call(this, req, res);
        });
        this.appServer.getExpress().post('/api/auth/changepassword', (req: Request, res: Response) => {
            this.changePasswordHandler.call(this, req, res);
        })
    }

    public getUserData(id: number): Promise<Result<User>> {
        return new Promise(r => {
            try {
                this.appServer.getDatabase().query(User, { where: [{ id: id }] }).then((result) => {
                    if (result.success) {
                        if (result.data && result.data.length > 0) {
                            r({ success: true, message: "Success", data: result.data[0] });
                        }
                        else {
                            r({ success: false, message: "User not found" });
                        }
                    }
                    else {
                        r({ success: false, message: `Failed to get user data: ${result.message}` });
                    }
                }).catch((err) => {
                    r({ success: false, message: `Failed to get user data: ${err}` });
                });
            } catch (err) {
                r({ success: false, message: `Failed to get user data: ${err}` });
            }
        });

    }

    private userMeHandler(req: Request, res: Response) {
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token) {
            res.statusCode = 401;
            res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
            return;
        }

        const payloadResult = this.getJWTPayload(token);
        if (!payloadResult.success) {
            res.statusCode = 401;
            res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
            return;
        }

        this.getUserData(payloadResult.data!.id).then((userResult) => {
            if (!userResult.success) {
                res.statusCode = 500;
                const traceId = crypto.randomUUID();
                this.appServer.getLogger().error(`traceId: ${traceId}, message: ${userResult.message}`);
                res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                return;
            }

            if (userResult.data!.role == 'deleted') {
                res.statusCode = 401;
                res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
                return;
            }

            if (userResult.data!.role == 'banned') {
                res.statusCode = 403;
                res.json({ code: "USER_BANNED", message: "用户已被封禁", data: {}, traceId: "" });
                return;
            }

            res.statusCode = 200;
            res.json({ code: "SUCCESS", message: "操作成功", data: { id: '' + userResult.data!.id, username: userResult.data!.username, email: userResult.data!.email, grade: userResult.data!.grade, className: userResult.data!.className, minecraftId: userResult.data!.minecraftId, role: userResult.data!.role, isVerified: userResult.data!.isVerified, createdAt: userResult.data!.createdAt, lastLoginAt: userResult.data!.lastLoginAt, bio: userResult.data!.bio }, traceId: "" });
            return;
        });
    }

    private registerHandler(req: Request, res: Response) {
        let body: RegisterRequest;
        try {
            body = req.body as RegisterRequest;
            if (body.className && body.email && body.grade && body.minecraftId && body.password && body.username) {
                body.className = body.className.toString().trim();
                body.email = body.email.toString().trim();
                body.grade = body.grade.toString().trim();
                body.minecraftId = body.minecraftId.toString().trim();
                body.username = body.username.toString().trim();
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
                        res.json({ code: "USERNAME_ALREADY_EXISTS", message: "用户名已存在", data: {}, traceId: "" });
                        return;
                    }
                    else {
                        this.appServer.getDatabase().query(User, { where: [{ email: body.email }] }).then((result) => {
                            if (result.success) {
                                if (result.data && result.data.length > 0) {
                                    res.statusCode = 409;
                                    res.json({ code: "EMAIL_ALREADY_USED", message: "邮箱已被占用", data: {}, traceId: "" });
                                    return;
                                }
                                else {
                                    const salt = crypto.randomUUID();
                                    this.appServer.getDatabase().createQueryBuilder(User, "user").insert().into("User").values({
                                        username: body.username,
                                        email: body.email,
                                        password: crypto.createHash('md5').update(body.password + salt).digest('hex'),
                                        grade: body.grade,
                                        className: body.className,
                                        minecraftId: body.minecraftId,
                                        salt: salt,
                                        role: 'member',
                                        isVerified: false,
                                        createdAt: new Date().toISOString(),
                                        lastLoginAt: new Date().toISOString(),
                                        bio: ''
                                    }).execute().then(() => {
                                        this.appServer.getDatabase().query(User, { where: [{ email: body.email }] }).then((result) => {
                                            res.statusCode = 200;
                                            res.json({ code: "SUCCESS", message: "注册成功", data: { token: jwt.sign({ id: result.data[0].id }, this.appServer.getConfig().secretKey, { expiresIn: '2h' }), user: { id: result.data[0].id, username: body.username, minecraftId: body.minecraftId } }, traceId: "" });
                                        })
                                        return;
                                    }).catch((error) => {
                                        const traceId = crypto.randomUUID();
                                        this.appServer.getLogger().error(`traceId: ${traceId} Failed to register user: ${error}`);
                                        res.statusCode = 500;
                                        res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                                        return;
                                    });
                                }
                            }
                            else {
                                const traceId = crypto.randomUUID();
                                this.appServer.getLogger().error(`traceId: ${traceId} Failed to register user: ${result.message}`);
                                res.statusCode = 500;
                                res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                                return;
                            }
                        });
                    }
                }
                else {
                    const traceId = crypto.randomUUID();
                    this.appServer.getLogger().error(`traceId: ${traceId} Failed to register user: ${result.message}`);
                    res.statusCode = 500;
                    res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                    return;
                }
            }).catch((err) => {
                const traceId = crypto.randomUUID();
                this.appServer.getLogger().error(`traceId: ${traceId} Failed to register user: ${err}`);
                res.statusCode = 500;
                res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                return;
            });
        } catch (err) {
            const traceId = crypto.randomUUID();
            this.appServer.getLogger().error(`traceId: ${traceId} Failed to register user: ${err}`);
            res.statusCode = 500;
            res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
            return;
        }
    }

    private loginHandler(req: Request, res: Response) {
        let body: LoginRequest;
        try {
            body = req.body as LoginRequest;
            if (body.email && body.password) {
                body.email = body.email.toString().trim();
                if (body.email.length > 255) {
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
        try {
            this.appServer.getDatabase().query(User, { where: [{ email: body.email }] }).then((result) => {
                if (result.success) {
                    if (result.data && result.data.length > 0) {
                        const user = result.data[0];
                        const hashedPassword = crypto.createHash('md5').update(body.password + user.salt).digest('hex');
                        if (user.role == 'deleted') {
                            res.statusCode = 404;
                            res.json({ code: "INVALID_CREDENTIALS", message: "无效的凭据", data: {}, traceId: "" });
                            return;
                        }
                        if (user.role == 'banned') {
                            res.statusCode = 403;
                            res.json({ code: "USER_BANNED", message: "用户已被封禁", data: {}, traceId: "" });
                            return;
                        }
                        if (hashedPassword === user.password) {
                            res.statusCode = 200;
                            res.json({ code: "SUCCESS", message: "登录成功", data: { token: jwt.sign({ id: user.id }, this.appServer.getConfig().secretKey, { expiresIn: '2h' }) }, traceId: "" });
                            return;
                        }
                        else {
                            res.statusCode = 401;
                            res.json({ code: "INVALID_CREDENTIALS", message: "无效的凭据", data: {}, traceId: "" });
                            return;
                        }
                    }
                    else {
                        res.statusCode = 401;
                        res.json({ code: "INVALID_CREDENTIALS", message: "无效的凭据", data: {}, traceId: "" });
                        return;
                    }
                }
                else {
                    const traceId = crypto.randomUUID();
                    this.appServer.getLogger().error(`traceId: ${traceId} Failed to login user: ${result.message}`);
                    res.statusCode = 500;
                    res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                    return;
                }
            }).catch((err) => {
                const traceId = crypto.randomUUID();
                this.appServer.getLogger().error(`traceId: ${traceId} Failed to login user: ${err}`);
                res.statusCode = 500;
                res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                return;
            });
        } catch (err) {
            const traceId = crypto.randomUUID();
            this.appServer.getLogger().error(`traceId: ${traceId} Failed to login user: ${err}`);
            res.statusCode = 500;
            res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
            return;
        }
    }

    public getJWTPayload(token: string): Result<JWTPayload> {
        try {
            return { success: true, message: "Success", data: jwt.verify(token, this.appServer.getConfig().secretKey) as JWTPayload };
        }
        catch (err) {
            return { success: false, message: "Invalid token" };
        }
    }

    private getUsersHandler(req: Request, res: Response) {
        // users data with pagination
        // role=admin required
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token) {
            res.statusCode = 401;
            res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
            return;
        }
        const payloadResult = this.getJWTPayload(token);
        if (!payloadResult.success) {
            res.statusCode = 401;
            res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
            return;
        }
        this.getUserData(payloadResult.data!.id).then((userResult) => {
            if (!userResult.success) {
                res.statusCode = 500;
                const traceId = crypto.randomUUID();
                this.appServer.getLogger().error(`traceId: ${traceId}, message: ${userResult.message}`);
                res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                return;
            }
            if (userResult.data!.role == 'deleted') {
                res.statusCode = 401;
                res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
                return;
            }
            if (userResult.data!.role == 'banned') {
                res.statusCode = 403;
                res.json({ code: "USER_BANNED", message: "用户已被封禁", data: {}, traceId: "" });
                return;
            }
            if (userResult.data!.role !== 'admin') {
                res.statusCode = 403;
                res.json({ code: "FORBIDDEN", message: "没有权限", data: {}, traceId: "" });
                return;
            }
            let page = parseInt(req.query.page as string) || 1;
            let pageSize = parseInt(req.query.limit as string) || 10;
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 10;
            if (pageSize > this.appServer.getConfig().paginationMaxPageSize) pageSize = this.appServer.getConfig().paginationMaxPageSize;
            this.appServer.getDatabase().createQueryBuilder(User, "user").select(["user.id", "user.username", "user.email", "user.grade", "user.className", "user.minecraftId", "user.role", "user.isVerified", "user.createdAt", "user.lastLoginAt", "user.bio"]).skip((page - 1) * pageSize).take(pageSize).getManyAndCount().then((result) => {
                res.statusCode = 200;
                res.json({ code: "SUCCESS", message: "操作成功", data: { users: result[0], pagination: { total: result[1], page, limit: pageSize } }, traceId: "" });
                return;
            }).catch((err) => {
                const traceId = crypto.randomUUID();
                this.appServer.getLogger().error(`traceId: ${traceId} Failed to get users: ${err}`);
                res.statusCode = 500;
                res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                return;
            });
        });
    }

    private getUserByIdHandler(req: Request, res: Response) {
        // get user data by id
        // if role=admin or the user to get is himself then return full info without password
        // else return info without password, email and lastLoginAt
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token) {
            res.statusCode = 401;
            res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
            return;
        }
        const payloadResult = this.getJWTPayload(token);
        if (!payloadResult.success) {
            res.statusCode = 401;
            res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
            return;
        }
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            res.statusCode = 400;
            res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: {}, traceId: "" });
            return;
        }
        this.getUserData(payloadResult.data!.id).then((userResult) => {
            if (!userResult.success) {
                res.statusCode = 500;
                const traceId = crypto.randomUUID();
                this.appServer.getLogger().error(`traceId: ${traceId}, message: ${userResult.message}`);
                res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                return;
            }
            if (userResult.data!.role == 'deleted') {
                res.statusCode = 404;
                res.json({ code: "USER_NOT_FOUND", message: "没有权限", data: {}, traceId: "" });
                return;
            }

            if (userResult.data!.role == 'banned') {
                res.statusCode = 403;
                res.json({ code: "USER_BANNED", message: "用户已被封禁", data: {}, traceId: "" });
                return;
            }
            this.getUserData(id).then((targetUserResult) => {
                if (!targetUserResult.success) {
                    res.statusCode = 404;
                    res.json({ code: "USER_NOT_FOUND", message: "用户未找到", data: {}, traceId: "" });
                    return;
                }
                if (userResult.data!.role === 'admin' || userResult.data!.id === id) {
                    res.statusCode = 200;
                    res.json({ code: "SUCCESS", message: "操作成功", data: { id: targetUserResult.data!.id, username: targetUserResult.data!.username, email: targetUserResult.data!.email, grade: targetUserResult.data!.grade, className: targetUserResult.data!.className, minecraftId: targetUserResult.data!.minecraftId, role: targetUserResult.data!.role, isVerified: targetUserResult.data!.isVerified, createdAt: targetUserResult.data!.createdAt, lastLoginAt: targetUserResult.data!.lastLoginAt, bio: targetUserResult.data!.bio }, traceId: "" });
                    return;
                }
                else {
                    res.statusCode = 200;
                    res.json({ code: "SUCCESS", message: "操作成功", data: { id: targetUserResult.data!.id, username: targetUserResult.data!.username, grade: targetUserResult.data!.grade, className: targetUserResult.data!.className, minecraftId: targetUserResult.data!.minecraftId, role: targetUserResult.data!.role, isVerified: targetUserResult.data!.isVerified, createdAt: targetUserResult.data!.createdAt, bio: targetUserResult.data!.bio }, traceId: "" });
                    return;
                }
            });
        });
    }

    private updateUserHandler(req: Request, res: Response) {
        // update user data by id
        // admin: allow to update anybody's username, email, grade, className, minecraftId, isVerified, role, bio
        // user: allow to update his username, email, grade, className, minecraftId, bio
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token) {
            res.statusCode = 401;
            res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
            return;
        }
        const payloadResult = this.getJWTPayload(token);
        if (!payloadResult.success) {
            res.statusCode = 401;
            res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
            return;
        }
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            res.statusCode = 400;
            res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: {}, traceId: "" });
            return;
        }
        let body: Partial<RegisterRequest> & { isVerified?: boolean; role?: string; bio?: string; };
        try {
            body = req.body as Partial<RegisterRequest> & { isVerified?: boolean; role?: string };
            if (body.username) {
                body.username = body.username.toString().trim();
                if (body.username.length > 255) {
                    res.statusCode = 400;
                    res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: {}, traceId: "" });
                    return;
                }
            }
            if (body.email) {
                body.email = body.email.toString().trim();
                if (body.email.length > 255) {
                    res.statusCode = 400;
                    res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: {}, traceId: "" });
                    return;
                }
            }
            if (body.grade) {
                body.grade = body.grade.toString().trim();
                if (body.grade.length > 255) {
                    res.statusCode = 400;
                    res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: {}, traceId: "" });
                    return;
                }
            }
            if (body.className) {
                body.className = body.className.toString().trim();
                if (body.className.length > 255) {
                    res.statusCode = 400;
                    res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: {}, traceId: "" });
                    return;
                }
            }
            if (body.minecraftId) {
                body.minecraftId = body.minecraftId.toString().trim();
                if (body.minecraftId.length >= 16) {
                    res.statusCode = 400;
                    res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: {}, traceId: "" });
                    return;
                }
            }
            if (body.role) {
                body.role = body.role.toString().trim();
                if (body.role !== 'member' && body.role !== 'admin' && body.role !== 'banned' && body.role !== 'deleted') {
                    res.statusCode = 400;
                    res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: {}, traceId: "" });
                    return;
                }
            }
            if (body.bio) {
                if (body.bio.length > this.appServer.getConfig().maxBioLength) {
                    res.statusCode = 400;
                    res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: {}, traceId: "" });
                    return;
                }
            }
            if (body.password) {
                res.statusCode = 400;
                res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: {}, traceId: "" });
                return;
            }
        } catch (err) {
            res.statusCode = 400;
            res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: { error: err }, traceId: "" });
            return;
        }
        this.getUserData(payloadResult.data!.id).then((userResult) => {
            if (!userResult.success) {
                res.statusCode = 500;
                const traceId = crypto.randomUUID();
                this.appServer.getLogger().error(`traceId: ${traceId}, message: ${userResult.message}`);
                res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                return;
            }
            if (userResult.data!.role == 'deleted') {
                res.statusCode = 404;
                res.json({ code: "USER_NOT_FOUND", message: "没有权限", data: {}, traceId: "" });
                return;
            }

            if (userResult.data!.role == 'banned') {
                res.statusCode = 403;
                res.json({ code: "USER_BANNED", message: "用户已被封禁", data: {}, traceId: "" });
                return;
            }
            // 查重: username, email 任意都不能有重复
            if (body.username) {
                this.appServer.getDatabase().query(User, { where: [{ username: body.username }] }).then((result) => {
                    if (result.success) {
                        if (result.data && result.data.length > 0 && result.data[0].id !== id) {
                            res.statusCode = 409;
                            res.json({ code: "USERNAME_ALREADY_EXISTS", message: "用户名已存在", data: {}, traceId: "" });
                            return;
                        }
                    }
                    else {
                        const traceId = crypto.randomUUID();
                        this.appServer.getLogger().error(`traceId: ${traceId} Failed to update user: ${result.message}`);
                        res.statusCode = 500;
                        res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                        return;
                    }
                }).catch((err) => {
                    const traceId = crypto.randomUUID();
                    this.appServer.getLogger().error(`traceId: ${traceId} Failed to update user: ${err}`);
                    res.statusCode = 500;
                    res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                    return;
                });
            }
            if (body.email) {
                this.appServer.getDatabase().query(User, { where: [{ email: body.email }] }).then((result) => {
                    if (result.success) {
                        if (result.data && result.data.length > 0 && result.data[0].id !== id) {
                            res.statusCode = 409;
                            res.json({ code: "EMAIL_ALREADY_USED", message: "邮箱已被占用", data: {}, traceId: "" });
                            return;
                        }
                    }
                    else {
                        const traceId = crypto.randomUUID();
                        this.appServer.getLogger().error(`traceId: ${traceId} Failed to update user: ${result.message}`);
                        res.statusCode = 500;
                        res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                        return;
                    }
                }).catch((err) => {
                    const traceId = crypto.randomUUID();
                    this.appServer.getLogger().error(`traceId: ${traceId} Failed to update user: ${err}`);
                    res.statusCode = 500;
                    res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                    return;
                });
            }
            this.getUserData(id).then((targetUserResult) => {
                if (!targetUserResult.success) {
                    res.statusCode = 404;
                    res.json({ code: "USER_NOT_FOUND", message: "用户未找到", data: {}, traceId: "" });
                    return;
                }
                if (userResult.data!.role !== 'admin' && userResult.data!.id !== id) {
                    res.statusCode = 403;
                    res.json({ code: "FORBIDDEN", message: "没有权限", data: {}, traceId: "" });
                    return;
                }
                if (body.role || body.isVerified !== undefined) {
                    if (userResult.data!.role !== 'admin') {
                        res.statusCode = 403;
                        res.json({ code: "FORBIDDEN", message: "没有权限", data: {}, traceId: "" });
                        return;
                    }
                }
                const updatedUser = targetUserResult.data!;
                if (body.username) updatedUser.username = body.username;
                if (body.email) updatedUser.email = body.email;
                if (body.grade) updatedUser.grade = body.grade;
                if (body.className) updatedUser.className = body.className;
                if (body.minecraftId) updatedUser.minecraftId = body.minecraftId;
                if (body.role) updatedUser.role = body.role;
                if (body.isVerified !== undefined) updatedUser.isVerified = body.isVerified;
                if (body.bio) updatedUser.bio = body.bio;
                this.appServer.getDatabase().save(User, updatedUser).then((saveResult) => {
                    if (!saveResult.success) {
                        const traceId = crypto.randomUUID();
                        this.appServer.getLogger().error(`traceId: ${traceId} Failed to update user: ${saveResult.message}`);
                        res.statusCode = 500;
                        res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                        return;
                    }
                    res.statusCode = 200;
                    res.json({ code: "SUCCESS", message: "操作成功", data: {}, traceId: "" });
                    return;
                }).catch((err) => {
                    const traceId = crypto.randomUUID();
                    this.appServer.getLogger().error(`traceId: ${traceId} Failed to update user: ${err}`);
                    res.statusCode = 500;
                    res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                    return;
                });
            });
        });
    }

    private deleteUserHandler(req: Request, res: Response) {
        //only admin can delete users
        //delete -> role := 'deleted'
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token) {
            res.statusCode = 401;
            res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
            return;
        }
        const payloadResult = this.getJWTPayload(token);
        if (!payloadResult.success) {
            res.statusCode = 401;
            res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
            return;
        }
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            res.statusCode = 400;
            res.json({ code: "BAD_REQUEST", message: "请求格式错误", data: {}, traceId: "" });
            return;
        }
        this.getUserData(payloadResult.data!.id).then((userResult) => {
            if (!userResult.success) {
                res.statusCode = 500;
                const traceId = crypto.randomUUID();
                this.appServer.getLogger().error(`traceId: ${traceId}, message: ${userResult.message}`);
                res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                return;
            }
            if (userResult.data!.role == 'deleted') {
                res.statusCode = 404;
                res.json({ code: "FORBIDDEN", message: "没有权限", data: {}, traceId: "" });
                return;
            }

            if (userResult.data!.role == 'banned') {
                res.statusCode = 403;
                res.json({ code: "USER_BANNED", message: "用户已被封禁", data: {}, traceId: "" });
                return;
            }
            if (userResult.data!.role !== 'admin') {
                res.statusCode = 403;
                res.json({ code: "FORBIDDEN", message: "没有权限", data: {}, traceId: "" });
                return;
            }
            this.getUserData(id).then((targetUserResult) => {
                if (!targetUserResult.success) {
                    res.statusCode = 404;
                    res.json({ code: "USER_NOT_FOUND", message: "用户未找到", data: {}, traceId: "" });
                    return;
                }
                if (targetUserResult.data!.role === 'deleted') {
                    res.statusCode = 400;
                    res.json({ code: "BAD_REQUEST", message: "用户已被删除", data: {}, traceId: "" });
                    return;
                }
                targetUserResult.data!.role = 'deleted';
                this.appServer.getDatabase().save(User, targetUserResult.data!).then((saveResult) => {
                    if (!saveResult.success) {
                        const traceId = crypto.randomUUID();
                        this.appServer.getLogger().error(`traceId: ${traceId} Failed to delete user: ${saveResult.message}`);
                        res.statusCode = 500;
                        res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                        return;
                    }
                    res.statusCode = 200;
                    res.json({ code: "SUCCESS", message: "操作成功", data: {}, traceId: "" });
                    return;
                }).catch((err) => {
                    const traceId = crypto.randomUUID();
                    this.appServer.getLogger().error(`traceId: ${traceId} Failed to delete user: ${err}`);
                    res.statusCode = 500;
                    res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                    return;
                });
            });
        });
    }

    private changePasswordHandler(req: Request, res: Response) {
        // only user himself can change his password
        // change salt together
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token) {
            res.statusCode = 401;
            res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
            return;
        }
        const payloadResult = this.getJWTPayload(token);
        if (!payloadResult.success) {
            res.statusCode = 401;
            res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
            return;
        }
        let body: ChangePasswordRequest;
        try {
            body = req.body as ChangePasswordRequest;
            if (body.oldPassword && body.newPassword) {
                if (body.oldPassword.length === 0 || body.newPassword.length === 0) {
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
        this.getUserData(payloadResult.data!.id).then((userResult) => {
            if (!userResult.success) {
                res.statusCode = 500;
                const traceId = crypto.randomUUID();
                this.appServer.getLogger().error(`traceId: ${traceId}, message: ${userResult.message}`);
                res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                return;
            }
            if (userResult.data!.role == 'deleted') {
                res.statusCode = 401;
                res.json({ code: "UNAUTHORIZED", message: "未授权", data: {}, traceId: "" });
                return;
            }

            if (userResult.data!.role == 'banned') {
                res.statusCode = 403;
                res.json({ code: "USER_BANNED", message: "用户已被封禁", data: {}, traceId: "" });
                return;
            }
            const hashedOldPassword = crypto.createHash('md5').update(body.oldPassword + userResult.data!.salt).digest('hex');
            if (hashedOldPassword !== userResult.data!.password) {
                res.statusCode = 401;
                res.json({ code: "INVALID_CREDENTIALS", message: "无效的凭据", data: {}, traceId: "" });
                return;
            }
            const newSalt = crypto.randomUUID();
            userResult.data!.salt = newSalt;
            userResult.data!.password = crypto.createHash('md5').update(body.newPassword + newSalt).digest('hex');
            this.appServer.getDatabase().save(User, userResult.data!).then((saveResult) => {
                if (!saveResult.success) {
                    const traceId = crypto.randomUUID();
                    this.appServer.getLogger().error(`traceId: ${traceId} Failed to change password: ${saveResult.message}`);
                    res.statusCode = 500;
                    res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                    return;
                }
                res.statusCode = 200;
                res.json({ code: "SUCCESS", message: "操作成功", data: {}, traceId: "" });
                return;
            }).catch((err) => {
                const traceId = crypto.randomUUID();
                this.appServer.getLogger().error(`traceId: ${traceId} Failed to change password: ${err}`);
                res.statusCode = 500;
                res.json({ code: "INTERNAL_SERVER_ERROR", message: "服务器内部错误", data: {}, traceId });
                return;
            });
        });
    }
}