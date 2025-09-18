import type { AppServerI, ModuleInfoI } from "../types.js";

export const moduleInfo: ModuleInfoI = {
    moduleName: "Test",
    moduleVersion: "v0.0.1",
    moduleDescription: "No description",
    moduleIdentifier: "test",
    entryPoint: (app: AppServerI) => {
        app.getLogger().info("Hello Modules!");
    }
};