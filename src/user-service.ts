import type { Request, Response } from "express";
import type { AppServerI, UserServiceI, JWTPayload, Result } from "./types.js";
import { User } from "./entity/User.js";
import jwt from 'jsonwebtoken';
import crypto from "crypto";
import { GenRes, ResponseType } from "./utils.js";
import { PointRecord } from "./entity/PointRecord.js";

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

type AddPointsRequest = {
    delta: number;
    description: string;
    relatedEntityType?: string;
    relatedEntityId?: number;
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
        });
        this.appServer.getExpress().get('/api/users/:id/points/record', (req: Request, res: Response) => {
            this.getPointsRecordsHandler.call(this, req, res);
        });
        this.appServer.getExpress().post('/api/users/:id/points/add', (req: Request, res: Response) => {
            this.addPointsHandler.call(this, req, res);
        });
    }

    private selectFields(fieldsToSelect: string[], data: object): Record<string, any> {
        return fieldsToSelect.reduce((acc, field) => {
            if (field === 'id') {
                acc[field] = '' + data![field];
            } else {
                acc[field] = data![field];
            }
            return acc;
        }, {} as Record<string, any>);
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
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }

        const payloadResult = this.getJWTPayload(token);
        if (!payloadResult.success) {
            res.statusCode = 401;
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }

        this.getUserData(payloadResult.data!.id).then((userResult) => {
            if (!userResult.success) {
                res.statusCode = 500;
                res.json(GenRes.error(userResult.message));
                return;
            }

            if (userResult.data!.role == 'deleted') {
                res.statusCode = 401;
                res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }

            if (userResult.data!.role == 'banned') {
                res.statusCode = 403;
                res.json(GenRes.fail(ResponseType.USER_BANNED));
                return;
            }

            res.statusCode = 200;
            const fieldsToSend = [
                'id',
                'username',
                'email',
                'grade',
                'className',
                'minecraftId',
                'role',
                'isVerified',
                'createdAt',
                'lastLoginAt',
                'bio',
                'points'
            ];

            res.json({
                code: "SUCCESS",
                message: "操作成功",
                data: this.selectFields(fieldsToSend, userResult.data!),
                traceId: ""
            });
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
                    res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
            }
            else {
                res.statusCode = 400;
                res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                return;
            }
        } catch (err) {
            res.statusCode = 400;
            res.json(GenRes.fail(ResponseType.BAD_REQUEST));
            return;
        }
        //TODO email verify
        try {
            this.appServer.getDatabase().query(User, { where: [{ username: body.username }] }).then((result) => {
                if (result.success) {
                    if (result.data && result.data.length > 0) {
                        res.statusCode = 409;
                        res.json(GenRes.fail(ResponseType.USERNAME_ALREADY_EXISTS));
                        return;
                    }
                    else {
                        this.appServer.getDatabase().query(User, { where: [{ email: body.email }] }).then((result) => {
                            if (result.success) {
                                if (result.data && result.data.length > 0) {
                                    res.statusCode = 409;
                                    res.json(GenRes.fail(ResponseType.EMAIL_ALREADY_USED));
                                    return;
                                }
                                else {
                                    const salt = crypto.randomUUID();
                                    this.appServer.getDatabase().getDataSource().getRepository(User).createQueryBuilder("user").insert().into("User").values({
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
                                        bio: '',
                                        points: 0,
                                    }).execute().then(() => {
                                        this.appServer.getDatabase().query(User, { where: [{ email: body.email }] }).then((result) => {
                                            res.statusCode = 200;
                                            res.json(GenRes.success({ token: jwt.sign({ id: result.data[0].id }, this.appServer.getConfig().secretKey, { expiresIn: '2h' }), user: { id: result.data[0].id, username: body.username, minecraftId: body.minecraftId } }));
                                        })
                                        return;
                                    }).catch((error) => {
                                        res.json(GenRes.error(error));
                                        return;
                                    });
                                }
                            }
                            else {
                                res.json(GenRes.error(result.message));
                                return;
                            }
                        });
                    }
                }
                else {
                    res.json(GenRes.error(result.message));
                    return;
                }
            }).catch((err) => {
                res.json(GenRes.error(err));
                return;
            });
        } catch (err) {
            res.json(GenRes.error(err));
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
                    res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
            }
            else {
                res.statusCode = 400;
                res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                return;
            }
        } catch (err) {
            res.statusCode = 400;
            res.json(GenRes.fail(ResponseType.BAD_REQUEST));
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
                            res.json(GenRes.fail(ResponseType.INVALID_CREDENTIALS));
                            return;
                        }
                        if (user.role == 'banned') {
                            res.statusCode = 403;
                            res.json(GenRes.fail(ResponseType.USER_BANNED));
                            return;
                        }
                        if (hashedPassword === user.password) {
                            res.statusCode = 200;
                            res.json(GenRes.success({ token: jwt.sign({ id: user.id }, this.appServer.getConfig().secretKey, { expiresIn: '2h' }) }));
                            return;
                        }
                        else {
                            res.statusCode = 401;
                            res.json(GenRes.fail(ResponseType.INVALID_CREDENTIALS));
                            return;
                        }
                    }
                    else {
                        res.statusCode = 401;
                        res.json(GenRes.fail(ResponseType.INVALID_CREDENTIALS));
                        return;
                    }
                }
                else {
                    res.json(GenRes.error(result.message));
                    return;
                }
            }).catch((err) => {
                res.json(GenRes.error(err));
                return;
            });
        } catch (err) {
            res.json(GenRes.error(err));
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
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }
        const payloadResult = this.getJWTPayload(token);
        if (!payloadResult.success) {
            res.statusCode = 401;
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }
        this.getUserData(payloadResult.data!.id).then((userResult) => {
            if (!userResult.success) {
                res.statusCode = 500;
                res.json(GenRes.error(userResult.message));
                return;
            }
            if (userResult.data!.role == 'deleted') {
                res.statusCode = 401;
                res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            if (userResult.data!.role == 'banned') {
                res.statusCode = 403;
                res.json(GenRes.fail(ResponseType.USER_BANNED));
                return;
            }
            if (userResult.data!.role !== 'admin') {
                res.statusCode = 403;
                res.json(GenRes.fail(ResponseType.FORBIDDEN));
                return;
            }
            let page = parseInt(req.query.page as string) || 1;
            let pageSize = parseInt(req.query.limit as string) || 10;
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 10;
            if (pageSize > this.appServer.getConfig().paginationMaxPageSize) pageSize = this.appServer.getConfig().paginationMaxPageSize;
            this.appServer.getDatabase().getDataSource().getRepository(User).createQueryBuilder("user").select(["user.id", "user.username", "user.email", "user.grade", "user.className", "user.minecraftId", "user.role", "user.isVerified", "user.createdAt", "user.lastLoginAt", "user.bio", "user.points"]).skip((page - 1) * pageSize).take(pageSize).getManyAndCount().then((result) => {
                res.statusCode = 200;
                res.json(GenRes.success({ users: result[0], pagination: { total: result[1], page, limit: pageSize } }));
                return;
            }).catch((err) => {
                res.statusCode = 500;
                res.json(GenRes.error(err));
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
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }
        const payloadResult = this.getJWTPayload(token);
        if (!payloadResult.success) {
            res.statusCode = 401;
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            res.statusCode = 400;
            res.json(GenRes.fail(ResponseType.BAD_REQUEST));
            return;
        }
        this.getUserData(payloadResult.data!.id).then((userResult) => {
            if (!userResult.success) {
                res.json(GenRes.error(userResult.message));
                return;
            }
            if (userResult.data!.role == 'deleted') {
                res.statusCode = 401;
                res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }

            if (userResult.data!.role == 'banned') {
                res.statusCode = 403;
                res.json(GenRes.fail(ResponseType.USER_BANNED));
                return;
            }
            this.getUserData(id).then((targetUserResult) => {
                if (!targetUserResult.success) {
                    res.statusCode = 404;
                    res.json(GenRes.fail(ResponseType.USER_NOT_FOUND));
                    return;
                }
                let fieldsToSend = ['id', 'username', 'grade', 'className', 'minecraftId', 'role', 'isVerified', 'createdAt', 'bio', 'points'];
                if (userResult.data!.role === 'admin' || userResult.data!.id === id) {
                    fieldsToSend.push('email', 'lastLoginAt');
                }
                res.statusCode = 200;
                res.json(GenRes.success(this.selectFields(fieldsToSend, targetUserResult.data!)));
                return;
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
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }
        const payloadResult = this.getJWTPayload(token);
        if (!payloadResult.success) {
            res.statusCode = 401;
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            res.statusCode = 400;
            res.json(GenRes.fail(ResponseType.BAD_REQUEST));
            return;
        }
        let body: Partial<RegisterRequest> & { isVerified?: boolean; role?: string; bio?: string; };
        try {
            body = req.body as Partial<RegisterRequest> & { isVerified?: boolean; role?: string; bio?: string; };
            if (body.username) {
                body.username = body.username.toString().trim();
                if (body.username.length > 255) {
                    res.statusCode = 400;
                    res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
            }
            if (body.email) {
                body.email = body.email.toString().trim();
                if (body.email.length > 255) {
                    res.statusCode = 400;
                    res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
            }
            if (body.grade) {
                body.grade = body.grade.toString().trim();
                if (body.grade.length > 255) {
                    res.statusCode = 400;
                    res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
            }
            if (body.className) {
                body.className = body.className.toString().trim();
                if (body.className.length > 255) {
                    res.statusCode = 400;
                    res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
            }
            if (body.minecraftId) {
                body.minecraftId = body.minecraftId.toString().trim();
                if (body.minecraftId.length >= 16) {
                    res.statusCode = 400;
                    res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
            }
            if (body.role) {
                body.role = body.role.toString().trim();
                if (body.role !== 'member' && body.role !== 'admin' && body.role !== 'banned' && body.role !== 'deleted') {
                    res.statusCode = 400;
                    res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
            }
            if (body.bio) {
                if (body.bio.length > this.appServer.getConfig().maxBioLength) {
                    res.statusCode = 400;
                    res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
            }
            if (body.password) {
                res.statusCode = 400;
                res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                return;
            }
        } catch (err) {
            res.statusCode = 400;
            res.json(GenRes.fail(ResponseType.BAD_REQUEST));
            return;
        }
        this.getUserData(payloadResult.data!.id).then((userResult) => {
            if (!userResult.success) {
                res.statusCode = 500;
                res.json(GenRes.error(userResult.message));
                return;
            }
            if (userResult.data!.role == 'deleted') {
                res.statusCode = 401;
                res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }

            if (userResult.data!.role == 'banned') {
                res.statusCode = 403;
                res.json(GenRes.fail(ResponseType.USER_BANNED));
                return;
            }
            // 查重: username, email 任意都不能有重复
            if (body.username) {
                this.appServer.getDatabase().query(User, { where: [{ username: body.username }] }).then((result) => {
                    if (result.success) {
                        if (result.data && result.data.length > 0 && result.data[0].id !== id) {
                            res.statusCode = 409;
                            res.json(GenRes.fail(ResponseType.USERNAME_ALREADY_EXISTS));
                            return;
                        }
                    }
                    else {
                        res.statusCode = 500;
                        res.json(GenRes.error(result.message));
                        return;
                    }
                }).catch((err) => {
                    res.json(GenRes.error(err));
                    return;
                });
            }
            if (body.email) {
                this.appServer.getDatabase().query(User, { where: [{ email: body.email }] }).then((result) => {
                    if (result.success) {
                        if (result.data && result.data.length > 0 && result.data[0].id !== id) {
                            res.statusCode = 409;
                            res.json(GenRes.fail(ResponseType.EMAIL_ALREADY_USED));
                            return;
                        }
                    }
                    else {
                        res.json(GenRes.error(result.message));
                        return;
                    }
                }).catch((err) => {
                    res.json(GenRes.error(err));
                    return;
                });
            }
            this.getUserData(id).then((targetUserResult) => {
                if (!targetUserResult.success) {
                    res.statusCode = 404;
                    res.json(GenRes.fail(ResponseType.USER_NOT_FOUND));
                    return;
                }
                if (userResult.data!.role !== 'admin' && userResult.data!.id !== id) {
                    res.statusCode = 403;
                    res.json(GenRes.fail(ResponseType.FORBIDDEN));
                    return;
                }
                if (body.role || body.isVerified !== undefined) {
                    if (userResult.data!.role !== 'admin') {
                        res.statusCode = 403;
                        res.json(GenRes.fail(ResponseType.FORBIDDEN));
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
                        res.statusCode = 500;
                        res.json(GenRes.error(saveResult.message));
                        return;
                    }
                    res.statusCode = 200;
                    res.json(GenRes.success({}));
                    return;
                }).catch((err) => {
                    res.json(GenRes.error(err));
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
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }
        const payloadResult = this.getJWTPayload(token);
        if (!payloadResult.success) {
            res.statusCode = 401;
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            res.statusCode = 400;
            res.json(GenRes.fail(ResponseType.BAD_REQUEST));
            return;
        }
        this.getUserData(payloadResult.data!.id).then((userResult) => {
            if (!userResult.success) {
                res.statusCode = 500;
                res.json(GenRes.error(userResult.message));
                return;
            }
            if (userResult.data!.role == 'deleted') {
                res.statusCode = 401;
                res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }

            if (userResult.data!.role == 'banned') {
                res.statusCode = 403;
                res.json(GenRes.fail(ResponseType.USER_BANNED));
                return;
            }
            if (userResult.data!.role !== 'admin') {
                res.statusCode = 403;
                res.json(GenRes.fail(ResponseType.FORBIDDEN));
                return;
            }
            this.getUserData(id).then((targetUserResult) => {
                if (!targetUserResult.success) {
                    res.statusCode = 404;
                    res.json(GenRes.fail(ResponseType.USER_NOT_FOUND));
                    return;
                }
                if (targetUserResult.data!.role === 'deleted') {
                    res.statusCode = 400;
                    res.json(GenRes.fail(ResponseType.USER_NOT_FOUND));
                    return;
                }
                targetUserResult.data!.role = 'deleted';
                this.appServer.getDatabase().save(User, targetUserResult.data!).then((saveResult) => {
                    if (!saveResult.success) {
                        res.json(GenRes.error(saveResult.message));
                        return;
                    }
                    res.statusCode = 200;
                    res.json(GenRes.success({}));
                    return;
                }).catch((err) => {
                    res.statusCode = 500;
                    res.json(GenRes.error(err));
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
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }
        const payloadResult = this.getJWTPayload(token);
        if (!payloadResult.success) {
            res.statusCode = 401;
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }
        let body: ChangePasswordRequest;
        try {
            body = req.body as ChangePasswordRequest;
            if (body.oldPassword && body.newPassword) {
                if (body.oldPassword.length === 0 || body.newPassword.length === 0) {
                    res.statusCode = 400;
                    res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
            }
            else {
                res.statusCode = 400;
                res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                return;
            }
        } catch (err) {
            res.statusCode = 400;
            res.json(GenRes.fail(ResponseType.BAD_REQUEST));
            return;
        }
        this.getUserData(payloadResult.data!.id).then((userResult) => {
            if (!userResult.success) {
                res.statusCode = 500;
                res.json(GenRes.error(userResult.message));
                return;
            }
            if (userResult.data!.role == 'deleted') {
                res.statusCode = 401;
                res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }

            if (userResult.data!.role == 'banned') {
                res.statusCode = 403;
                res.json(GenRes.fail(ResponseType.USER_BANNED));
                return;
            }
            const hashedOldPassword = crypto.createHash('md5').update(body.oldPassword + userResult.data!.salt).digest('hex');
            if (hashedOldPassword !== userResult.data!.password) {
                res.statusCode = 401;
                res.json(GenRes.fail(ResponseType.INVALID_CREDENTIALS));
                return;
            }
            const newSalt = crypto.randomUUID();
            userResult.data!.salt = newSalt;
            userResult.data!.password = crypto.createHash('md5').update(body.newPassword + newSalt).digest('hex');
            this.appServer.getDatabase().save(User, userResult.data!).then((saveResult) => {
                if (!saveResult.success) {
                    res.statusCode = 500;
                    res.json(GenRes.error(saveResult.message));
                    return;
                }
                res.statusCode = 200;
                res.json(GenRes.success({}));
                return;
            }).catch((err) => {
                res.statusCode = 500;
                res.json(GenRes.error(err));
                return;
            });
        });
    }

    // Points management 

    private getPointsRecordsHandler(req: Request, res: Response) {
        // get point records with pagination
        // if admin then get any user's records
        // else get only his own records
        // url /api/points/:id/records
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token) {
            res.statusCode = 401;
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }
        const payloadResult = this.getJWTPayload(token);
        if (!payloadResult.success) {
            res.statusCode = 401;
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            res.statusCode = 400;
            res.json(GenRes.fail(ResponseType.BAD_REQUEST));
            return;
        }
        this.getUserData(payloadResult.data!.id).then((userResult) => {
            if (!userResult.success) {
                res.statusCode = 500;
                res.json(GenRes.error(userResult.message));
                return;
            }
            if (userResult.data!.role == 'deleted') {
                res.statusCode = 401;
                res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }

            if (userResult.data!.role == 'banned') {
                res.statusCode = 403;
                res.json(GenRes.fail(ResponseType.USER_BANNED));
                return;
            }
            if (userResult.data!.role !== 'admin' && userResult.data!.id !== id) {
                res.statusCode = 403;
                res.json(GenRes.fail(ResponseType.FORBIDDEN));
                return;
            }
            let page = parseInt(req.query.page as string) || 1;
            let pageSize = parseInt(req.query.limit as string) || 10;
            if (page < 1) page = 1;
            if (pageSize < 1) pageSize = 10;
            if (pageSize > this.appServer.getConfig().paginationMaxPageSize) pageSize = this.appServer.getConfig().paginationMaxPageSize;
            this.appServer.getDatabase().getDataSource().getRepository(PointRecord).createQueryBuilder("pointRecord").leftJoinAndSelect("pointRecord.user", "user").where("user.id = :userId", { userId: id }).select(["pointRecord.points", "pointRecord.description", "pointRecord.relatedEntityType", "pointRecord.relatedEntityId", "pointRecord.createdAt"]).orderBy("pointRecord.createdAt", "DESC").skip((page - 1) * pageSize).take(pageSize).getManyAndCount().then((result) => {
                res.statusCode = 200;
                res.json(GenRes.success({ records: result[0], pagination: { total: result[1], page, limit: pageSize } }));
                return;
            }).catch((err) => {
                res.statusCode = 500;
                res.json(GenRes.error(err));
                return;
            });
        });
    }

    public addPoints(userId: number, delta: number, description: string, relatedEntityType?: string, relatedEntityId?: number): Promise<Result<null>> {
        return new Promise(r => {
            // update user points then create records
            this.appServer.getDatabase().query(User, { where: [{ id: userId }] }).then((userResult) => {
                if (!userResult.success) {
                    r({ success: false, message: `Failed to get user data: ${userResult.message}` });
                    return;
                }
                if (!userResult.data || userResult.data.length === 0) {
                    r({ success: false, message: "User not found" });
                    return;
                }
                const user = userResult.data[0];
                user.points += delta;
                this.appServer.getDatabase().save(User, user).then((saveResult) => {
                    if (!saveResult.success) {
                        r({ success: false, message: `Failed to update user points: ${saveResult.message}` });
                        return;
                    }
                    const pointRecord = new PointRecord();
                    pointRecord.user = user;
                    pointRecord.points = delta;
                    pointRecord.description = description;
                    pointRecord.relatedEntityType = relatedEntityType || null;
                    pointRecord.relatedEntityId = relatedEntityId || null;
                    this.appServer.getDatabase().save(PointRecord, pointRecord).then((recordSaveResult) => {
                        if (!recordSaveResult.success) {
                            r({ success: false, message: `Failed to create point record: ${recordSaveResult.message}` });
                            return;
                        }
                        r({ success: true, message: "Points updated and record created successfully", data: null });
                        return;
                    }).catch((err) => {
                        r({ success: false, message: `Failed to create point record: ${err}` });
                        return;
                    });
                }).catch((err) => {
                    r({ success: false, message: `Failed to update user points: ${err}` });
                    return;
                });
            }).catch((err) => {
                r({ success: false, message: `Failed to get user data: ${err}` });
                return;
            });
        });
    }

    public getPoints(userId: number): Promise<Result<number>> {
        return new Promise(r => {
            this.appServer.getDatabase().query(User, { where: [{ id: userId }] }).then((userResult) => {
                if (!userResult.success) {
                    r({ success: false, message: `Failed to get user data: ${userResult.message}` });
                    return;
                }
                if (!userResult.data || userResult.data.length === 0) {
                    r({ success: false, message: "User not found" });
                    return;
                }
                const user = userResult.data[0];
                r({ success: true, message: "Success", data: user.points });
                return;
            }).catch((err) => {
                r({ success: false, message: `Failed to get user data: ${err}` });
                return;
            });
        });
    }

    private addPointsHandler(req: Request, res: Response) {
        // only admin can add points to users
        const token = req.headers.authorization?.replace("Bearer ", "");
        if (!token) {
            res.statusCode = 401;
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }
        const payloadResult = this.getJWTPayload(token);
        if (!payloadResult.success) {
            res.statusCode = 401;
            res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
            return;
        }
        const id = parseInt(req.params.id);
        if (isNaN(id) || id <= 0) {
            res.statusCode = 400;
            res.json(GenRes.fail(ResponseType.BAD_REQUEST));
            return;
        }
        let body: { delta: number; description: string; relatedEntityType?: string; relatedEntityId?: number; };
        try {
            body = req.body as { delta: number; description: string; relatedEntityType?: string; relatedEntityId?: number; };
            if (body.delta === undefined || body.description === undefined) {
                res.statusCode = 400;
                res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                return;
            }
            if (typeof body.delta !== 'number' || isNaN(body.delta) || body.delta === 0) {
                res.statusCode = 400;
                res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                return;
            }
            if (typeof body.description !== 'string' || body.description.trim().length === 0 || body.description.length > 255) {
                res.statusCode = 400;
                res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                return;
            }
            body.description = body.description.trim();
            if (body.relatedEntityType) {
                if (typeof body.relatedEntityType !== 'string' || body.relatedEntityType.trim().length === 0 || body.relatedEntityType.length > 50) {
                    res.statusCode = 400;
                    res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                body.relatedEntityType = body.relatedEntityType.trim();
            }
            if (body.relatedEntityId) {
                if (typeof body.relatedEntityId !== 'number' || isNaN(body.relatedEntityId) || body.relatedEntityId <= 0) {
                    res.statusCode = 400;
                    res.json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
            }
        } catch (err) {
            res.statusCode = 400;
            res.json(GenRes.fail(ResponseType.BAD_REQUEST));
            return;
        }
        this.getUserData(payloadResult.data!.id).then((userResult) => {
            if (!userResult.success) {
                res.statusCode = 500;
                res.json(GenRes.error(userResult.message));
                return;
            }
            if (userResult.data!.role == 'deleted') {
                res.statusCode = 401;
                res.json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }

            if (userResult.data!.role == 'banned') {
                res.statusCode = 403;
                res.json(GenRes.fail(ResponseType.USER_BANNED));
                return;
            }
            if (userResult.data!.role !== 'admin') {
                res.statusCode = 403;
                res.json(GenRes.fail(ResponseType.FORBIDDEN));
                return;
            }
            this.addPoints(id, body.delta, body.description, body.relatedEntityType, body.relatedEntityId).then((addResult) => {
                if (!addResult.success) {
                    res.statusCode = 500;
                    res.json(GenRes.error(addResult.message));
                    return;
                }
                res.statusCode = 200;
                res.json(GenRes.success({}));
                return;
            });
        });
    }
}