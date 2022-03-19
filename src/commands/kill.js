import CONSTANTS from "../CONSTANTS.js";
import { SlashCommandBuilder } from "@discordjs/builders";

/** @type {import("../../types/command").default} */
const info = {
	apply: process.env.NODE_ENV !== "production",
	data: new SlashCommandBuilder().setDescription("Kills the bot.").setDefaultPermission(false),

	interaction: (interaction) => {
		console.log(interaction.user.tag, "is killing the bot.");
		process.exit();
	},

	permissions: [{ id: CONSTANTS.redGuyId, permission: true, type: "USER" }],
};

export default info;
