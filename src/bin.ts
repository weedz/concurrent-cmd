import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Cmds } from "./index.js";

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


const ccmds = new Cmds({
    cwd: values.cwd,
    printDate: values.time,
}, newProcessEnv);

process.on("SIGINT", async (code) => {
    console.log("Recieved SIGINT signal.");
    await Promise.allSettled(ccmds.killChildren(code));
    process.exit(0);
});

for (const cmd of cmds) {
    if (Array.isArray(cmd)) {
        for (const subCommand of cmd) {
            await spawnCommandFromString(subCommand);
        }
    } else {
        spawnCommandFromString(cmd);
    }
}

// TODO: Should probably use `yargs` instead
function spawnCommandFromString(cmdString: string) {
    const argsIndex = cmdString.indexOf(" ");
    const command = argsIndex > 0 ? cmdString.slice(0, argsIndex) : cmdString;
    const args = argsIndex > 0 ? cmdString.slice(argsIndex + 1).split(" ") : [];

    return ccmds.spawnCommand(command, args);
}

