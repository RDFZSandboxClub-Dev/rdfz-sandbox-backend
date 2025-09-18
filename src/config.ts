import * as z from 'zod';
import * as yaml from 'yaml';
import * as fs from 'fs-extra';
import type { Logger } from 'log4js';
import type { AppServerI, ConfigI, Result } from './types.js';


const configSchema = z.strictObject({
    logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
	port: z.number().readonly(),
    modulesDir: z.string().default('./modules').readonly(),
    dbHost: z.string().default('localhost').readonly(),
    dbPort: z.number().default(3306).readonly(),
    dbUsername: z.string().default('root').readonly(),
    dbPassword: z.string().default('admin').readonly(),
    dbName: z.string().default('rdfzscweb').readonly(),
    secretKey: z.string().nonempty().readonly()
})


export type ConfigSchema = z.infer<typeof configSchema>;

export class Config implements ConfigI {
    private config: ConfigSchema;
    private logger: Logger;
    private appServer: AppServerI;
    constructor(path: string, appServer: AppServerI) {
        this.logger = appServer.getLogger();
        try {
            const configFile = yaml.parse(fs.readFileSync(path, 'utf-8'));
            this.config = configSchema.parse(configFile);
            this.logger.info('Configuration loaded successfully.');
        } catch (error) {
            this.logger.fatal(`Failed to load configuration file: ${error}, quitting...`);
            process.exit(1);
        }
        appServer.getBus().emit('config_loaded');
    }

    save(path: string): Result<undefined> {
        this.logger.trace(`Saving configuration...`)
        try {
            fs.writeFileSync(path, yaml.stringify(this.config));
            this.logger.info(`Successfully saved configuration.`);
            return {success: true, message: `Successfully saved configuration.`};
        }
        catch (error) {
            this.logger.error(`Failed to save configuration file to ${path}: ${error}`);
            return {success: false, message: `Failed to save configuration file to ${path}: ${error}`};
        }
    }

    load(path: string): Result<undefined> {
        let _config: ConfigSchema;
        try {
            const configFile = yaml.parse(fs.readFileSync(path, 'utf-8'));
            _config = configSchema.parse(configFile);
        } catch (error) {
            this.logger.error(`Failed to load configuration file: ${error}.`);
            return {success: false, message: `Failed to load configuration file: ${error}`};
        }
        this.config = _config;
        this.logger.info('Configuration reloaded successfully.');
        globalThis.appServer.getBus().emit('config_loaded');
        return {success: true, message: `Successfully reloaded configuration.`};
    }

    getConfig(): ConfigSchema {
        return this.config;
    }
}