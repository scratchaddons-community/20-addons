import { SlashCommandBuilder } from "@discordjs/builders";
import {
	Message,
	MessageActionRow,
	MessageButton,
	MessageEmbed,
	MessageSelectMenu,
} from "discord.js";

import addons from "../common/addons.js";
import CONSTANTS from "../common/CONSTANTS.js";
import { checkIfUserPlaying, CURRENTLY_PLAYING } from "../common/gameUtils.js";
import questionsByAddon from "../common/questions.js";
import generateHash from "../lib/generateHash.js";

const questions = Object.values(questionsByAddon)
	.flat()
	.filter(
		({ question }, index, array) =>
			!array.some((foundQuestion, id) => foundQuestion.question === question && id > index),
	)
	.sort(
		(one, two) =>
			(one.order || Number.POSITIVE_INFINITY) - (two.order || Number.POSITIVE_INFINITY) ||
			(one.userAsking.toLowerCase() < two.userAsking.toLowerCase() ? -1 : 1),
	)
	.reduce((accumulator, { group, userAsking }) => {
		/** @param {number} [index] */
		function addToGroup(index = 0) {
			accumulator[`${group}`] ??= [];

			if ((accumulator[`${group}`]?.[+index]?.length || 0) < 25) {
				accumulator[`${group}`][+index] ??= [];
				accumulator[`${group}`]?.[+index]?.push(userAsking);
			} else {
				addToGroup(index + 1);
			}
		}

		addToGroup();

		return accumulator;
	}, /** @type {{ [key: string]: string[][] }} */ ({}));

const selectGroupButton = (/** @type {string | undefined} */ defaultValue) =>
	new MessageSelectMenu()
		.setPlaceholder("Select a group")
		.setCustomId(generateHash("group"))
		.setOptions(
			Object.keys(questions)
				.map((group) => ({
					default: typeof defaultValue === "string" ? group === defaultValue : false,
					label: group,
					value: group,
				}))
				.sort(({ label: one }, { label: two }) => (one === two ? 0 : one < two ? -1 : 1)),
		);

/** @type {import("../../types/command").default} */
const info = {
	apply: process.env.NODE_ENV !== "production",
	data: new SlashCommandBuilder().setDescription("I think of an addon and you guess!"),

	async interaction(interaction) {
		if (await checkIfUserPlaying(interaction)) return;

		/** @type {Set<string>} */
		const doneQuestions = new Set();

		const addon = addons[Math.floor(Math.random() * addons.length)];

		if (!addon) throw new ReferenceError("No addons exist!");

		if (process.env.NODE_ENV !== "production") console.log(addon.id);

		const message = await interaction.reply({
			components: [
				new MessageActionRow().addComponents(selectGroupButton()),
				new MessageActionRow().addComponents(
					new MessageButton()
						.setLabel("End")
						.setStyle("SECONDARY")
						.setCustomId(generateHash("end")),
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
			.on("collect", async (selectInteraction) => {
				if (selectInteraction.customId.startsWith("end")) {
					CURRENTLY_PLAYING.delete(interaction.user.id);
					await selectInteraction.reply({
						content: `${interaction.user.toString()} chose to end game early.`,
					});

					collector.stop();

					return;
				}

				if (!selectInteraction.isSelectMenu()) return;

				const selected = selectInteraction.values[0] || "";
				const split = selected.split(".");
				const question =
					questions[`${split[0] || ""}`]?.[+(split[1] || 0)]?.[+(split[2] || 0)] || "";
				const groupName = split[0] || selected;

				if (question) doneQuestions.add(selected);

				const doneGroups = Object.entries(questions).reduce(
					(accumulator, [group, questions]) => {
						if (
							questions.every((subQuestions, selectIndex) =>
								subQuestions.every((_, index) =>
									doneQuestions.has(`${group}.${selectIndex}.${index}`),
								),
							)
						)
							accumulator.add(group);

						return accumulator;
					},
					/** @type {Set<string>} */ (new Set()),
				);

				const groupSelects =
					questions[`${groupName}`]?.reduce((accumulator, group, selectIndex) => {
						const options = group
							.map((label, index) => ({
								label,
								value: `${groupName}.${selectIndex}.${index}`,
							}))
							.filter(({ value }) => !doneQuestions.has(value));

						const select = new MessageSelectMenu()
							.setCustomId(generateHash(groupName))
							.setPlaceholder(
								`Select a question (${
									accumulator[0] ? "continued" : "irreversible"
								})`,
							)
							.setOptions(options);

						const row = new MessageActionRow().setComponents(select);

						if (options.length > 0) accumulator.push(row);

						return accumulator;
					}, /** @type {MessageActionRow[]} */ ([])) || [];

				const groupSelection = selectGroupButton(split[0] || "");

				const groupsToSelect = groupSelection.options
					.map((option) => ({
						default: option.default,
						label: option.label,
						value: option.value,
					}))
					.filter((o) => !doneGroups.has(o.value));

				await Promise.all([
					selectInteraction.deferUpdate(),
					interaction.editReply({
						components: [
							...(groupsToSelect.length > 0
								? [
										new MessageActionRow().setComponents([
											groupSelection.setOptions(...groupsToSelect),
										]),
										...groupSelects,
								  ]
								: []),
							new MessageActionRow().setComponents([
								new MessageButton()
									.setLabel("End")
									.setStyle("SECONDARY")
									.setCustomId(generateHash("end")),
							]),
						],

						embeds: [
							split.length === 3
								? new MessageEmbed(message.embeds[0])
										.setDescription(
											`${message.embeds[0]?.description || ""}\n${question} ${
												questionsByAddon[addon.id]?.find(
													({ userAsking }) => userAsking === question,
												)
													? "**Yes**"
													: "**No**"
											}`.trim(),
										)
										.setFooter({
											text:
												message.embeds[0]?.footer?.text.replace(
													/\d+ questions?/,
													(previousCount) =>
														`${
															1 + +(previousCount.split(" ")[0] || 0)
														} question${
															previousCount === "0 questions"
																? ""
																: "s"
														}`,
												) || "",
										})
								: new MessageEmbed(message.embeds[0]),
						],
					}),
				]);
				collector.resetTimer();
			})
			.on("end", async (collected) => {
				CURRENTLY_PLAYING.delete(interaction.user.id);

				await Promise.all([
					collected.size > 0
						? Promise.resolve()
						: message.reply(
								`${interaction.user.toString()}, you didn’t ask me any questions! I’m going to end the game.`,
						  ),
					interaction.editReply({
						components: message.components.map((row) =>
							row.setComponents(
								row.components.map((component) => component.setDisabled(true)),
							),
						),

						content: message.content || undefined,
					}),
				]);
			});
	},
};

export default info;
