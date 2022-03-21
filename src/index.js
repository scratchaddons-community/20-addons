/** @file Run Bot. */
import http from "http";
import path from "path";
import url from "url";

import { Client, MessageEmbed, Util } from "discord.js";
import dotenv from "dotenv";

import importScripts from "./lib/importScripts.js";
import pkg from "./lib/package.js";

dotenv.config();

const dirname = path.dirname(url.fileURLToPath(import.meta.url));

const client = new Client({
	failIfNotExists: false,

	intents: [
		"GUILDS",
		"GUILD_MESSAGES",
		"GUILD_MESSAGE_REACTIONS",
		"DIRECT_MESSAGES",
		"GUILD_MEMBERS",
		"GUILD_BANS",
		"GUILD_EMOJIS_AND_STICKERS",
		"GUILD_INTEGRATIONS",
		"GUILD_WEBHOOKS",
		"GUILD_INVITES",
		"GUILD_VOICE_STATES",
		"GUILD_PRESENCES",
		"GUILD_MESSAGE_TYPING",
		"DIRECT_MESSAGE_REACTIONS",
		"DIRECT_MESSAGE_TYPING",
		"GUILD_SCHEDULED_EVENTS",
	],

	partials: ["USER", "MESSAGE", "CHANNEL", "GUILD_MEMBER", "REACTION", "GUILD_SCHEDULED_EVENT"],
	presence: { activities: [{ name: "the SA Bot Jam!", type: "COMPETING", url: pkg.homepage }] },
	restGlobalRateLimit: 50,
	restWsBridgeTimeout: 30_000,
});

const events = await importScripts(
	/** @type {`${string}events`} */ (path.resolve(dirname, "./events")),
);

for (const [event, execute] of events.entries()) {
	if (execute.apply === false) continue;

	client[execute.once ? "once" : "on"](event, async (...args) => {
		try {
			await execute.event(...args);

			return;
		} catch (error) {
			try {
				console.error(error);

				const embed = new MessageEmbed()
					.setTitle("Error!")
					.setDescription(
						`Uh-oh! I found an error! (event **${Util.escapeMarkdown(
							event,
						)}**)\n\`\`\`json\n${Util.cleanCodeBlockContent(JSON.stringify(error))}\`\`\``,
					)
					.setColor("LUMINOUS_VIVID_PINK");
				const { LOGS_CHANNEL } = process.env;

				if (!LOGS_CHANNEL) throw new ReferenceError("LOGS_CHANNEL is not set in the .env");

				const testingChannel = await client.channels.fetch(LOGS_CHANNEL);

				if (!testingChannel?.isText())
					throw new ReferenceError("Could not find error reporting channel");

				await testingChannel.send({ embeds: [embed] });
			} catch (errorError) {
				console.error(errorError);
			}
		}
	});
}

await client.login(process.env.BOT_TOKEN);

const server = http.createServer((_, response) => {
	response.writeHead(302, { location: pkg.homepage });
	response.end();
});

server.listen(process.env.PORT || 80);
