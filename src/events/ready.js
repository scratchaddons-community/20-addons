/** @file Initialize Bot on ready. Register commands and etc. */

import { Collection, MessageEmbed } from "discord.js";

import commands from "../lib/commands.js";
import pkg from "../lib/package.js";

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
					.setDescription(`Version **v${pkg.version}**`)
					.setColor("RANDOM"),
			],
		});

		/**
		 * @type {Collection<
		 * 	string,
		 * 	{
		 * 		command: import("../../types/command").Command;
		 * 		permissions?: import("discord.js").ApplicationCommandPermissionData[];
		 * 	}
		 * >}
		 */
		const slashes = new Collection();

		for (const [key, command] of commands.entries()) {
			if (command.apply !== false)
				slashes.set(key, { command: command.data, permissions: command.permissions });
		}

		const guilds = await client.guilds.fetch();
		const promises = [];

		for (const guild of guilds.values()) {
				const promise = client.application.commands
					.fetch({guildId: guild.id}).catch(() =>{})
					.then(async (prexistingCommands) => {
						if(!prexistingCommands) return
						await Promise.all(
							prexistingCommands.map((command) => {
								if (slashes.has(command.name)) return false;

								return command.delete();
							}),
						);

						await Promise.all(
							slashes.map(async ({ command, permissions }, name) => {
								const newCommand = await (prexistingCommands.has(name)
									? client.application?.commands.edit(
											name,
											command.toJSON(),
											guild.id,
									  )
									: client.application?.commands.create(
											command.toJSON(),
											guild.id,
									  ));

								if (permissions)
									await newCommand?.permissions.add({
										guild: guild.id,
										permissions,
									});
							}),
						);
					});

				promises.push(promise);
		}

		await Promise.all(promises);
	},

	once: true,
};

export default event;
