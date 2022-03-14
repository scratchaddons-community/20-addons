/** @file Command To get information about an addon. */
import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageEmbed } from "discord.js";
import fetch from "node-fetch";

import CONSTANTS from "../CONSTANTS.js";
import escapeMessage, { escapeLinks } from "../lib/escape.js";
import generateTooltip from "../lib/generateTooltip.js";
import joinWithAnd from "../lib/joinWithAnd.js";

const addons = await fetch(
	"https://github.com/ScratchAddons/website-v2/raw/master/data/addons/en.json",
).then(
	async (response) =>
		/** @type {Promise<import("../../types/addonManifest").WebsiteData>} */ (
			await response.json()
		),
);

/** @type {{ [key: string]: import("../../types/addonManifest").default }} */
const manifestCache = {};

/** @type {import("../../types/command").default} */
const info = {
	data: new SlashCommandBuilder().setDescription(
		"Replies with information about a specific addon.",
	),

	async interaction(interaction) {
		/**
		 * Generate a string of Markdown that credits the makers of an addon.
		 *
		 * @param {import("../../types/addonManifest").default["credits"]} credits - Addon manifest.
		 *
		 * @returns {string | undefined} - Returns credit information or undefined if no credits are
		 *   available.
		 */
		function generateCredits(credits) {
			return joinWithAnd(
				credits?.map(({ name, link, note = "" }) =>
					link
						? `[${escapeLinks(name)}](${link} "${note}")`
						: note
						? generateTooltip(interaction, name, note)
						: name,
				) || [],
			);
		}

		const item = addons[Math.floor(Math.random() * addons.length)];

		if (!item) throw new RangeError("No addons available?");

		const embed = new MessageEmbed()
			.setTitle(item.name)
			.setColor(CONSTANTS.colors.theme)
			.setDescription(
				`${escapeMessage(item.description)}\n[See source code](${
					CONSTANTS.repos.sa
				}/tree/master/addons/${encodeURIComponent(item.id)})`,
			)
			.setFooter({
				text: "Random addon",
			});

		const group = item.tags.includes("popup")
			? "Extension Popup Features"
			: item.tags.includes("easterEgg")
			? "Easter Eggs"
			: item.tags.includes("theme")
			? "Themes"
			: item.tags.includes("community")
			? "Scratch Website Features"
			: "Scratch Editor Features";

		if (group !== "Easter Eggs") {
			embed.setURL(
				`https://scratch.mit.edu/scratch-addons-extension/settings#addon-${encodeURIComponent(
					item.id,
				)}`,
			);
		}

		const addon = (manifestCache[item.id] ||= await fetch(
			`${CONSTANTS.repos.sa}/addons/${item.id}/addon.json?date=${Date.now()}`,
		).then(
			async (response) =>
				await /** @type {Promise<import("../../types/addonManifest").default>} */ (
					response.json()
				),
		));

		const lastUpdatedIn = `last updated in ${
			addon.latestUpdate?.version || "<unknown version>"
		}`;
		const latestUpdateInfo = addon.latestUpdate
			? ` (${
					addon.latestUpdate.temporaryNotice
						? generateTooltip(
								interaction,
								lastUpdatedIn,
								`${addon.latestUpdate?.temporaryNotice}`,
						  )
						: lastUpdatedIn
			  })`
			: "";

		const credits = generateCredits(addon.credits);

		if (credits) embed.addField("Contributors", credits, true);

		embed
			.setImage(
				`https://scratchaddons.com/assets/img/addons/${encodeURIComponent(item.id)}.png`,
			)
			.addFields([
				{
					inline: true,
					name: "Group",
					value: escapeMessage(group),
				},
				{
					inline: true,
					name: "Version added",
					value: escapeMessage(addon.versionAdded + latestUpdateInfo),
				},
			]);

		await interaction.reply({ embeds: [embed] });
	},
};

export default info;
