import { type ChildProcess, spawn } from "node:child_process";
import { styleText } from "node:util";

function printDate() {
    return ` [${new Date().toISOString()}]`;
}

function printDate_empty() {
    return "";
}

export class Cmds {
    cwd: string | undefined;
    printDate: () => string;

    #newProcessEnv: Record<string, any>;
    #childProcess: ChildProcess[] = [];

    constructor(options: {
        cwd?: string;
        printDate?: boolean;
    } = {}, env: Record<string, any> = {}) {
        this.cwd = options.cwd;
        this.printDate = options.printDate ? printDate : printDate_empty;
        this.#newProcessEnv = env;
    }

    spawnCommand(command: string, args: string[] = []) {
        return new Promise<number>((resolve) => {
            const child = spawn(command, args, { cwd: this.cwd, env: this.#newProcessEnv });
            const i = this.#childProcess.push(child) - 1;

            child.stdout.on("data", (data: Buffer) => {
                process.stdout.write(`[${i}]${this.printDate()}: ${data.toString("utf-8").trim()}\n`);
            });
            child.stderr.on("data", (data: Buffer) => {
                process.stdout.write(`[${i}]${this.printDate()} ${styleText("red", "(STDERR)")}: ${data.toString("utf-8").trim()}\n`);
            });
            child.on("exit", (code) => {
                process.stdout.write(`[${i}]${this.printDate()}: '${command}' Exited with code ${code ?? "SIGINT"}\n`);
                resolve(code || 0);
            });
        });
    }

    killChildren(code: NodeJS.Signals = "SIGKILL") {
        return this.#childProcess.map(child => {
            return new Promise<void>((resolve) => {
                child.once("exit", resolve);
                child.kill(code);
            });
        });
    }

}
