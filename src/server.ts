import * as log4js from "log4js";
import express from 'express';
import type { AppServerI, DatabaseI, ModuleControllerI, Result } from "./types.js";
import { ModuleController } from "./module-controller.js";
import * as path from 'path';
import { Config, type ConfigSchema } from "./config.js";
import { DataSource, type EntityTarget, type QueryBuilder } from "typeorm";
import { EventEmitter } from "events";
import { UserService } from "./user-service.js";

export class Database implements DatabaseI {

    private dataSource: DataSource;
    private logger: log4js.Logger;
    constructor(appServer: AppServerI) {
        this.logger = appServer.getLogger();
        try {
            this.dataSource = new DataSource({
                type: "mysql",
                host: appServer.getConfig().dbHost,
                port: appServer.getConfig().dbPort,
                username: appServer.getConfig().dbUsername,
                password: appServer.getConfig().dbPassword,
                database: appServer.getConfig().dbName,
                entities: [__dirname + "/entity/*.ts"],
                synchronize: true,
                logging: false
            });
        } catch (error) {
            this.logger.fatal(`Failed to initialize database connection: ${error}, quitting...`);
            process.exit(1);
        }
        appServer.getBus().on('stop', () => {
            this.logger.info('Disconnecting database...');
            this.dataSource.destroy();
            process.exit(0);
        })
    }

    connect(): Promise<Result<undefined>> {
        return new Promise((resolve) => {
            this.dataSource.initialize().then(() => {
                this.logger.info('Database connection established successfully.');
                resolve({ success: true, message: 'Database connection established successfully.' });
            }).catch((error) => {
                this.logger.fatal(`Failed to connect to database: ${error}, quitting...`);
                process.exit(1);
            });
        });
    }

    query<T>(target: EntityTarget<T>, params?: object): Promise<Result<T[]>> {
        return new Promise((res) => {
            this.dataSource.getRepository(target).find(params).then((results) => {
                res({ success: true, message: 'Query executed successfully.', data: results });
            }).catch((error) => {
                this.logger.error(`Failed to execute query: ${error}`);
                res({ success: false, message: `Failed to execute query: ${error}`, data: [] });
            });
        });
    }

    save<T>(target: EntityTarget<T>, item: T): Promise<Result<undefined>> {
        return new Promise((res) => {
            this.dataSource.getRepository(target).save(item).then(() => {
                res({ success: true, message: 'Update executed successfully.', });
            }).catch((error) => {
                this.logger.error(`Failed to execute update: ${error}`);
                res({ success: false, message: `Failed to execute update: ${error}`});
            });
        });
    }

    remove<T>(target: EntityTarget<T>, item: T): Promise<Result<undefined>> {
        return new Promise((res) => {
            this.dataSource.getRepository(target).remove(item).then(() => {
                res({ success: true, message: 'Remove executed successfully.', });
            }).catch((error) => {
                this.logger.error(`Failed to execute remove: ${error}`);
                res({ success: false, message: `Failed to execute remove: ${error}`});
            });
        });
    }

    createQueryBuilder<T>(target: EntityTarget<T>, alias: string): QueryBuilder<T> {
        return this.dataSource.getRepository(target).createQueryBuilder(alias);
    }

}

export class AppServer implements AppServerI {
    private expressApp: express.Express;
    private logger: log4js.Logger;
    private moduleController: ModuleControllerI;
    private config: Config;
    private eventBus: EventEmitter;
    private database: DatabaseI;
    private UserService: UserService;

    constructor() {
        // 先创建默认的 logger
        log4js.configure({
            appenders: {
                console: { type: 'console' },
                file: { type: 'file', filename: 'logs/app.log', maxLogSize: 10485760, backups: 3, compress: true }
            },
            categories: {
                default: { appenders: ['console', 'file'], level: 'info' }
            }
        });
        this.logger = log4js.getLogger('app');


        this.eventBus = new EventEmitter();
        this.config = new Config('./config.yml', this);

        // 加载配置文件，用配置文件的内容设置 logger
        this.getBus().on('config_loaded', () => {
            log4js.configure({
                appenders: {
                    console: { type: 'console' },
                    file: { type: 'file', filename: 'logs/app.log', maxLogSize: 10485760, backups: 3, compress: true }
                },
                categories: {
                    default: { appenders: ['console', 'file'], level: this.getConfig().logLevel }
                }
            });
        })

        this.database = new Database(this);

        this.expressApp = express();
        this.expressApp.use(express.json());
        this.moduleController = new ModuleController();
        this.UserService = new UserService(this);
    }

    public loadModules(): void {
        this.moduleController.loadModules(this, path.join(__dirname, 'modules'));
    }

    public getConfig(): ConfigSchema {
        return this.config.getConfig();
    }

    public getExpress(): express.Express {
        return this.expressApp;
    }

    public getLogger(): log4js.Logger {
        return this.logger;
    }

    public listen(port: number): void {
        this.expressApp.listen(port, () => {
            this.getBus().emit('listen');
            this.logger.info(`Server is listening on port ${port}`);
        });
    }

    public getBus(): EventEmitter {
        return this.eventBus;
    }

    public connectDb(): Promise<Result<undefined>> {
        return this.database.connect();
    }

    public getDatabase(): DatabaseI {
        return this.database;
    }
}