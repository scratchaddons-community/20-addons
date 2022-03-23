import { SlashCommandBuilder } from "@discordjs/builders";
import { Message, MessageActionRow, MessageEmbed, MessageSelectMenu } from "discord.js";

import CONSTANTS from "../common/CONSTANTS.js";
import { CURRENTLY_PLAYING } from "../common/gameUtils.js";
import questionsByAddon from "../common/questions.js";
import generateHash from "../lib/generateHash.js";

const questions = questionsByAddon
	.flatMap(([, addonQuestions]) =>
		addonQuestions.map(({ group, order, userAsking }) => ({
			group,
			order,
			question: userAsking,
		})),
	)
	.filter(
		({ question }, index, array) =>
			!array.some((foundQuestion, id) => foundQuestion.question === question && id > index),
	)
	.sort(
		(one, two) =>
			(one.order || Number.POSITIVE_INFINITY) - (two.order || Number.POSITIVE_INFINITY) ||
			(one.question.toLowerCase() < two.question.toLowerCase() ? -1 : 1),
	)
	.reduce((accumulator, { group, question }) => {
		/** @param {number} [index] */
		function addToGroup(index = 0) {
			accumulator[`${group}`] ??= [];

			if ((accumulator[`${group}`]?.[+index]?.length || 0) < 25) {
				accumulator[`${group}`][+index] ??= [];
				accumulator[`${group}`]?.[+index]?.push(question);
			} else {
				addToGroup(index + 1);
			}
		}

		addToGroup();

		return accumulator;
	}, /** @type {{ [key: string]: string[][] }} */ ({}));

/** @type {import("../../types/command").default} */
const info = {
	apply: process.env.NODE_ENV !== "production",
	data: new SlashCommandBuilder().setDescription("I think of an addon and you guess!"),

	async interaction(interaction) {
		const message = await interaction.reply({
			components: [
				new MessageActionRow().addComponents(
					new MessageSelectMenu()
						.setPlaceholder("Select a group")
						.setDisabled(false)
						.setCustomId(generateHash("group"))
						.setMaxValues(1)
						.setMinValues(0)
						.setOptions(
							Object.keys(questions).map((group) => ({ label: group, value: group })),
						),
				),
			],

			embeds: [
				new MessageEmbed()
					.setColor(CONSTANTS.themeColor)
					.setAuthor(
						interaction.member && "displayAvatarURL" in interaction.member
							? {
									iconURL: interaction.member.displayAvatarURL(),

									name: interaction.member.displayName,
							  }
							: {
									iconURL: interaction.user.displayAvatarURL(),

									name: interaction.user.username,
							  },
					)
					.setTitle("Guess the addon!")
					.setFooter({
						text: `Pick a question for me to answer from a dropdown below${CONSTANTS.footerSeperator}0 questions asked`,
					}),
			],

			fetchReply: true,
		});

		if (!(message instanceof Message)) throw new TypeError("message is not a Message");

		CURRENTLY_PLAYING.set(interaction.user.id, message);

		const collector = message.createMessageComponentCollector({
			filter: (componentInteraction) => componentInteraction.user.id === interaction.user.id,
			time: 120_000,
		});

		collector
			.on("collect", async (componentInteraction) => {
				if (componentInteraction.customId.startsWith("end")) {
					CURRENTLY_PLAYING.delete(interaction.user.id);
					await componentInteraction.reply({
						content: `${interaction.user.toString()} chose to end game early.`,
					});

					collector.stop();

					return;
				}

				await Promise.all([
					componentInteraction.deferUpdate(),
					interaction.editReply({
						components: message.components.map((row) =>
							row.setComponents(row.components[0]),
						),

						content: message.content || undefined,
					}),
				]);
				collector.stop();
			})
			.on("end", async (collected) => {
				if (collected.size > 0) return;

				CURRENTLY_PLAYING.delete(interaction.user.id);

				await Promise.all([
					interaction.followUp(
						`${interaction.user.toString()}, you didn’t ask me any questions! I’m going to end the game.`,
					),
					interaction.editReply({
						components: message.components.map((row) =>
							row.setComponents(
								row.components.map((component) =>
									component.type === "BUTTON"
										? component
												.setDisabled(true)
												.setStyle(
													component.customId ===
														collected.first()?.customId
														? "SUCCESS"
														: "SECONDARY",
												)
										: component.setDisabled(true),
								),
							),
						),

						content: message.content || undefined,
					}),
				]);
			});
	},
};

export default info;
