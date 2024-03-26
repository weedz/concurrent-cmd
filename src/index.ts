import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync } from "node:fs";

let shouldPrintDate: boolean = false;
function printDate() {
    if (shouldPrintDate) {
        return ` [${new Date().toISOString()}]`;
    }
    return "";
}

let cwd: undefined | string;
let commandsFile: undefined | string;

const cmdsFromArgv: string[] = [];

// Skip "bin" arguments (like `node` and the path to this script), assumes we run in "node" environment and
// just skip the first 2 arguments :+1:
for (const arg of process.argv.slice(2)) {
    // Handle flags and arguments
    if (arg.startsWith("--")) {
        const [argument, value] = arg.split("=", 2);
        if (argument === "--cwd") {
            cwd = value;
        } else if (argument === "--time") {
            shouldPrintDate = true;
        } else if (argument === "--file") {
            commandsFile = value;
        }
    } else {
        cmdsFromArgv.push(arg);
    }
}

if (cmdsFromArgv.length !== 1 && !commandsFile) {
    console.error("doin it wrong..");
    process.exit(1);
}

const cmds: (string | string[])[] = (() => {
    if (commandsFile) {
        try {
            const cmds = JSON.parse(readFileSync(commandsFile).toString("utf-8"));
            // TODO: Validate stuff
            return cmds;
        } catch (err) {
            console.error("Failed to read file. Error:", err);
            process.exit(1);
        }
    } else {
        // TODO: Validate `cmds`
        return JSON.parse(cmdsFromArgv[0]);
    }
})();

const childProcess: ChildProcess[] = [];

for (let i = 0; i < cmds.length; ++i) {
    const cmd = cmds[i];
    if (Array.isArray(cmd)) {
        spawnSubcommands(cmd, i);
    } else {
        spawnCommand(cmd, i);
    }
}

process.on("SIGINT", async (code) => {
    await Promise.allSettled(childProcess.map(child => {
        return new Promise<void>((resolve) => {
            child.once("exit", resolve);
            child.kill(code);
        });
    }));
    process.exit(0);
});

// TODO: Should probably use `yargs` instead
function parseCommand(cmd: string) {
    const argsIndex = cmd.indexOf(" ");
    const command = argsIndex > 0 ? cmd.slice(0, argsIndex) : cmd;
    const args = argsIndex > 0 ? cmd.slice(argsIndex + 1).split(" ") : undefined;
    return { command, args };
}

function spawnCommand(commandStr: string, i: number) {
    return new Promise<number>((resolve) => {
        const { command, args } = parseCommand(commandStr);
        const child = spawn(command, args, { cwd });
        childProcess.push(child);
        child.stdout.on("data", (data: Buffer) => {
            console.log(`[${i}]${printDate()}: ${data.toString("utf-8").trim()}`);
        });
        child.stderr.on("data", (data: Buffer) => {
            console.warn(`[${i}]${printDate()} [${new Date().toISOString()}] (err): ${data.toString("utf-8").trim()}`);
        });
        child.on("exit", (code) => {
            console.log(`[${i}]${printDate()}: "${commandStr}" Exited with code ${code ?? "SIGINT"}`);
            if (code === 0) {
                resolve(0);
            } else {
                resolve(code || 0);
            }
        });
    });
}

async function spawnSubcommands(subcommands: string[], i: number) {
    for (const subcommand of subcommands) {
        await spawnCommand(subcommand, i);
    }
}

