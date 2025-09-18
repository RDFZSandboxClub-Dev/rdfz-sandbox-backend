import type { Request, Response } from "express";
import { AppServer } from "./server.js";
import "reflect-metadata";

const appServer = new AppServer();
appServer.getExpress().get('/', (req: Request, res: Response) => {
    res.send('Hello, World!');
});
await appServer.connectDb();
appServer.loadModules();
appServer.listen(appServer.getConfig().port);

process.on('SIGINT', () => {
    appServer.getBus().emit('stop');
})