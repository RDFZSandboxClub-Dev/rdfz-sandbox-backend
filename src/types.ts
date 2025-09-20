import * as express from 'express';
import * as log4js from 'log4js';
import type { ConfigSchema } from './config.js';
import type { DataSource, EntityTarget } from 'typeorm';
import type EventEmitter from 'events';
import type { User } from './entity/User.js';

export interface Result<T> {
    success: boolean;
    message: string;
    data?: T;
}

export interface AppServerI {
    getExpress(): express.Express;
    getLogger(): log4js.Logger;
    listen(port: number): void;
    getConfig(): ConfigSchema;
    getBus(): EventEmitter;
    loadModules(): void;
    connectDb(): Promise<Result<undefined>>;
    getDatabase(): DatabaseI;
}

export interface ModuleI {
    moduleInfo: ModuleInfoI;
}

export interface ModuleInfoI {
    moduleName: string;
    moduleDescription: string;
    moduleIdentifier: string;
    moduleVersion: string;
    entryPoint: {(app: AppServerI): void};
}

export interface ModuleControllerI {
    loadModules(app: AppServerI, modulesPath: string): void;
}

export interface ConfigI {
    save(path: string): Result<undefined>;
    load(path: string): Result<undefined>;
    getConfig(): ConfigSchema;
}

export interface DatabaseI {
    connect(): Promise<Result<undefined>>;
    query<T>(target: EntityTarget<T>, params?: object): Promise<Result<T[]>>;
    save<T>(target: EntityTarget<T>, item: T): Promise<Result<undefined>>;
    remove<T>(target: EntityTarget<T>, item: T): Promise<Result<undefined>>;
    getDataSource(): DataSource;
}

export type JWTPayload = {
    id: number
}

export interface UserServiceI {
    getJWTPayload(token: string): Result<JWTPayload>;
    getUserData(id: number): Promise<Result<User>>;
    addPoints(userId: number, delta: number, description: string, relatedEntityType?: string, relatedEntityId?: number): Promise<Result<null>>;
}