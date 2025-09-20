import { randomUUID } from "crypto";
import * as log4js from 'log4js';

export enum ResponseType {
    BAD_REQUEST = 14000,
    INTERNAL_SERVER_ERROR = 15000,
    UNAUTHORIZED = 14010,
    INVALID_CREDENTIALS = 14011,
    USER_NOT_FOUND = 14041,
    NOT_FOUND = 14040,
    USER_BANNED = 14031,
    USERNAME_ALREADY_EXISTS = 14090,
    SUCCESS = 12000,
    EMAIL_ALREADY_USED = 14091,
    FORBIDDEN = 14030
}

const defaultMessage = {
    [ResponseType.BAD_REQUEST]: "请求格式错误",
    [ResponseType.INTERNAL_SERVER_ERROR]: "服务端错误",
    [ResponseType.UNAUTHORIZED]: "未登录",
    [ResponseType.INVALID_CREDENTIALS]: "无效的凭据",
    [ResponseType.USER_NOT_FOUND]: "用户不存在",
    [ResponseType.NOT_FOUND]: "请求的资源不存在",
    [ResponseType.USER_BANNED]: "用户已被封禁",
    [ResponseType.USERNAME_ALREADY_EXISTS]: "用户名已存在",
    [ResponseType.SUCCESS]: "成功",
    [ResponseType.EMAIL_ALREADY_USED]: "邮箱已被使用",
    [ResponseType.FORBIDDEN]: "没有权限"
}

export class GenRes {
    public static error(error: unknown) {
        const traceId = randomUUID();
        log4js.getLogger('app').error(`traceId: ${traceId} ${error}`)
        return {code: ResponseType.INTERNAL_SERVER_ERROR, message: defaultMessage[ResponseType.INTERNAL_SERVER_ERROR], data: {}, traceId: traceId};
    }

    public static success(data: object) {
        return {code: ResponseType.SUCCESS, message: defaultMessage[ResponseType.SUCCESS], data: data};
    }

    public static fail(code: ResponseType, message?: string) {
        return {code, message: message?message:defaultMessage[code], data: {}};
    }
}