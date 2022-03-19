/** @file Fetch And output all commands. */

import path from "path";
import url from "url";

import importScripts from "./importScripts.js";

const dirname = path.dirname(url.fileURLToPath(import.meta.url));

const commands = await importScripts(
	/** @type {`${string}commands`} */ (path.resolve(dirname, "../commands")),
);

for (const [name, command] of commands.entries())
	if (!command.data.name) command.data.setName(name);

export default commands;
