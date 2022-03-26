/** @file Initialize Bot on ready. Register commands and etc. */

import { Collection, MessageEmbed } from "discord.js";

import commands from "../lib/commands.js";
import package_ from "../lib/package.js";

/** @type {import("../../types/event").default<"ready">} */
const event = {
	async event(client) {
		console.log(
			`Connected to Discord with ID ${client.application.id} and tag ${
				client.user?.tag || ""
			}`,
		);

		const { LOGS_CHANNEL } = process.env;

		if (!LOGS_CHANNEL) throw new ReferenceError("LOGS_CHANNEL is not set in the .env");

		const channel = await client.channels.fetch(LOGS_CHANNEL);

		if (!channel?.isText()) throw new ReferenceError("Could not find error reporting channel");

		await channel?.send({
			embeds: [
				new MessageEmbed()
					.setTitle("Bot restarted!")
					.setDescription(`Version **v${package_.version}**`)
					.setColor("RANDOM"),
			],
		});

		/** @type {Collection<string, import("../../types/command").Command>} */
		const slashes = new Collection();

		for (const [key, command] of commands.entries())
			if (command.apply !== false) slashes.set(key, command.data);

		const prexistingCommands = await client.application.commands.fetch().catch(() => {});

		if (!prexistingCommands) return;

		await Promise.all(
			prexistingCommands.map(async (command) => {
				if (slashes.has(command.name)) return false;

				return await command.delete();
			}),
		);

		await Promise.all(
			slashes.map(
				async (command, name) =>
					await (prexistingCommands.has(name)
						? client.application?.commands.edit(name, command.toJSON())
						: client.application?.commands.create(command.toJSON())),
			),
		);
	},

	once: true,
};

export default event;
