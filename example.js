import * as fs from "node:fs";
import { setTimeout } from "node:timers/promises";
import { Cmds } from "@weedzcokie/concurrent-cmd";

if (fs.existsSync("./dist")) {
  fs.rmSync("./dist", { recursive: true });
}

const newProcessEnv = { ...process.env, FORCE_COLOR: "true" };
const ccmds = new Cmds(undefined, newProcessEnv);
ccmds.spawnCommand("./node_modules/.bin/tsc", ["--watch", "--preserveWatchOutput"]);

// Wait a second to allow tsc to run
await setTimeout(1000);

// Or wait until `dist` directory is created
while (!fs.existsSync("./dist")) {
  await setTimeout(100);
}

ccmds.spawnCommand("node", ["--watch", "--watch-preserve-output", "dist/main.js"]);

ccmds.installSignalHandler("SIGINT");

