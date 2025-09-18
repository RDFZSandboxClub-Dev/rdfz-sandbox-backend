import type { AppServerI, ModuleControllerI, ModuleInfoI, ModuleI } from "./types.js";
import * as fs from 'fs-extra';
import * as path from 'path';

// ensure a module is a module
function isModule(mod: any): mod is ModuleI {
    const moduleInfo: any = (mod as ModuleI).moduleInfo;
    if(moduleInfo == undefined) return false;
    if(!moduleInfo.moduleName || typeof moduleInfo.moduleName !== 'string') return false;
    if(!moduleInfo.moduleDescription || typeof moduleInfo.moduleDescription !== 'string') return false;
    if(!moduleInfo.moduleIdentifier || typeof moduleInfo.moduleIdentifier !== 'string') return false;
    if(!moduleInfo.moduleVersion || typeof moduleInfo.moduleVersion !== 'string') return false;
    if(!moduleInfo.entryPoint || typeof moduleInfo.entryPoint !== 'function') return false;
    return true;
}

export class ModuleController implements ModuleControllerI {
    public async loadModules(app: AppServerI, modulesPath: string): Promise<void> {
        if (!fs.existsSync(modulesPath)) {
            app.getLogger().warn(`Modules path "${modulesPath}" does not exist.`);
            return;
        }

        const moduleFiles = fs.readdirSync(modulesPath).filter((file: string) => file.endsWith('.ts'));

        moduleFiles.forEach(async (file: string) => {
            const modulePath = path.join(modulesPath, file);
            try {
                const mod: any = await import(modulePath);
                if (isModule(mod)) {
                    mod.moduleInfo.entryPoint(app);
                    app.getLogger().info(`Loaded module: ${mod.moduleInfo.moduleName} ${mod.moduleInfo.moduleVersion} from ${file}`);
                } else {
                    app.getLogger().error(`Module at "${modulePath}" is not a module. Skipping...`);
                }
            } catch (error: unknown) {
                app.getLogger().error(`Failed to load module at "${modulePath}": ${error}, skipping...`);
            }
        })
    }
}