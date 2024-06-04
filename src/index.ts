import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

// TODO: Should probably use `yargs` instead
function parseCommand(cmd: string) {
    const argsIndex = cmd.indexOf(" ");
    const command = argsIndex > 0 ? cmd.slice(0, argsIndex) : cmd;
    const args = argsIndex > 0 ? cmd.slice(argsIndex + 1).split(" ") : [];
    return { command, args };
}

function spawnCommand(commandStr: string, i: number) {
    return new Promise<number>((resolve) => {
        const { command, args } = parseCommand(commandStr);

        const child = spawn(command, args, { cwd, env: newProcessEnv });
        childProcess.push(child);
        child.stdout.on("data", (data: Buffer) => {
            process.stdout.write(`[${i}]${printDate()}: ${data.toString("utf-8").trim()}\n`);
        });
        child.stderr.on("data", (data: Buffer) => {
            process.stdout.write(`[${i}]${printDate()} (STDERR): ${data.toString("utf-8").trim()}\n`);
        });
        child.on("exit", (code) => {
            process.stdout.write(`[${i}]${printDate()}: "${commandStr}" Exited with code ${code ?? "SIGINT"}\n`);
            resolve(code || 0);
        });
    });
}

async function spawnSubcommands(subcommands: string[], i: number) {
    for (const subcommand of subcommands) {
        await spawnCommand(subcommand, i);
    }
}

function printDate() {
    if (shouldPrintDate) {
        return ` [${new Date().toISOString()}]`;
    }
    return "";
}

const newProcessEnv = { ...process.env, FORCE_COLOR: "true" };

const { values } = parseArgs({
    options: {
        cwd: { type: "string" },
        time: { type: "boolean" },
        file: { type: "string" },
        cmd: { type: "string" },
    }
});

if (values.file && values.cmd) {
    throw new Error("Only use ONE of '--file', '--cmd'");
}

const cwd = values.cwd;
const shouldPrintDate = values.time || false;

const cmds: (string | string[])[] = (() => {
    if (values.file) {
        try {
            const cmds = JSON.parse(readFileSync(values.file).toString("utf-8"));
            // TODO: Validate stuff
            return cmds;
        } catch (err) {
            console.error("Failed to read file. Error:", err);
            process.exit(1);
        }
    } else if (values.cmd) {
        // TODO: Validate `cmds`
        return JSON.parse(values.cmd);
    } else {
        throw new Error("Must give one of '--file', '--cmd'");
    }
})();
if (cmds.length === 0) {
    console.error("doin it wrong..");
    process.exit(1);
}

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
    console.log("Recieved SIGINT signal.");
    await Promise.allSettled(childProcess.map(child => {
        return new Promise<void>((resolve) => {
            child.once("exit", resolve);
            child.kill(code);
        });
    }));
    process.exit(0);
});

