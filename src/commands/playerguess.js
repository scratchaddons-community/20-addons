import { SlashCommandBuilder } from "@discordjs/builders";
import {
	Message,
	MessageActionRow,
	MessageButton,
	MessageEmbed,
	MessageSelectMenu,
	Util,
} from "discord.js";
import Fuse from "fuse.js";

import addons from "../common/addons.js";
import CONSTANTS from "../common/CONSTANTS.js";
import { checkIfUserPlaying, CURRENTLY_PLAYING } from "../common/gameUtils.js";
import questionsByAddon from "../common/questions.js";
import generateHash from "../lib/generateHash.js";

const fuse = new Fuse(addons, {
	findAllMatches: true,
	ignoreLocation: true,
	includeScore: true,

	keys: [
		{
			name: "id",
			weight: 1,
		},
		{
			name: "name",
			weight: 1,
		},
	],
});

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
				new MessageActionRow().addComponents([
					new MessageButton()
						.setLabel("End")
						.setStyle("SECONDARY")
						.setCustomId(generateHash("end")),
					new MessageButton()
						.setLabel("Hint")
						.setStyle("SECONDARY")
						.setCustomId(generateHash("hint")),
				]),
			],

			content:
				"Select a question for me to answer from one of the dropdowns below. When you have an idea of what the addon I'm thinking of might be, reply to this message with its name!",

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

		const componentCollector = message.createMessageComponentCollector({
			filter: (componentInteraction) => componentInteraction.user.id === interaction.user.id,
			time: 120_000,
		});

		const messageCollector = message.channel.createMessageCollector({
			filter: (collectedMessage) =>
				collectedMessage.author.id === interaction.user.id &&
				collectedMessage.type === "REPLY" &&
				collectedMessage.reference?.messageId === message.id,
		});

		messageCollector
			.on("collect", async (collectedMessage) => {
				const { item, score } = fuse.search(collectedMessage.content)[0] ?? {};

				componentCollector.resetTimer();
				messageCollector.resetTimer();

				if (!item || score > 1) {
					return await collectedMessage.reply({
						content: `I couldn't find that addon!`,
					});
				}

				const editPromise = interaction.editReply({
					embeds: [
						new MessageEmbed(message.embeds[0])
							.setDescription(
								`${message.embeds[0]?.description || ""}\n* Is it the ${
									item.name
								} addon? **${item.id === addon.id ? "Yes" : "No"}**`.trim(),
							)
							.setFooter({
								text:
									message.embeds[0]?.footer?.text.replace(
										/\d+ questions?/,
										(previousCount) =>
											`${1 + +(previousCount.split(" ")[0] || 0)} question${
												previousCount === "0 questions" ? "" : "s"
											}`,
									) || "",
							}),
					],
				});

				if (item.id !== addon.id) {
					return await Promise.all([
						editPromise,
						collectedMessage.reply({
							content: `${interaction.user.toString()}, that's not the right addon!`,
						}),
					]);
				}

				await Promise.all([
					editPromise,
					collectedMessage.reply({
						content: `${interaction.user.toString()}, the addon *is* **${Util.escapeMarkdown(
							addon.name,
						)}**! You got it right!`,

						embeds: [
							new MessageEmbed()
								.setTitle(addon.name)
								.setDescription(
									`${
										Object.entries(questionsByAddon)
											.find(([id]) => id === addon.id)?.[1]
											?.map(({ statement }) => `* ${statement}`)
											.join("\n") || ""
									}\n\n*Run <@929928324959055932>'s \`/addon\` command for more information about this addon!*`,
								)
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
								.setColor(CONSTANTS.themeColor)
								.setThumbnail(
									`https://scratchaddons.com/assets/img/addons/${encodeURI(
										addon.id,
									)}.png`,
								)
								.setURL(
									`https://scratch.mit.edu/scratch-addons-extension/settings#addon-${encodeURIComponent(
										addon.id,
									)}`,
								),
						],
					}),
				]);

				messageCollector.stop();
			})
			.on("end", () => {
				componentCollector.stop("GOT_CORRECT_ANSWER");
			});

		componentCollector
			.on("collect", async (componentInteraction) => {
				/**
				 * @param {string} question
				 * @param {string} groupName
				 * @param {boolean} updateEmbed
				 */
				async function answerQuestion(question, groupName,updateEmbed=true, split = [groupName]) {
					if (question) doneQuestions.add(question);

					const doneGroups = Object.entries(questions).reduce(
						(accumulator, [group, questions]) => {
							if (
								questions.every((subQuestions) =>
									subQuestions.every((question) => doneQuestions.has(question)),
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
								.filter(({ label }) => !doneQuestions.has(label));

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

					await interaction.editReply({
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
								new MessageButton()
									.setLabel("Hint")
									.setStyle("SECONDARY")
									.setCustomId(generateHash("hint")),
							]),
						],

						embeds: updateEmbed?[new MessageEmbed(message.embeds[0])
										.setDescription(
											`${
												message.embeds[0]?.description || ""
											}\n* ${question} ${
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
										}),
						]:undefined,
					});
				}

				if (componentInteraction.customId.startsWith("hint")) {
					const hint = questionsByAddon[addon.id]
						?.sort(() => Math.random() - 0.5)
						.find((question) => !doneQuestions.has(question.userAsking));

					await componentInteraction.reply({
						content: `${interaction.user.toString()}, ${
							hint
								? `here's a hint. ${hint.statement}`
								: "I don't have a hint for you!"
						}`,
					});

					if (hint) await answerQuestion(hint.userAsking, hint.group);

					componentCollector.resetTimer();
					messageCollector.resetTimer();

					return;
				}

				if (componentInteraction.customId.startsWith("end")) {
					await componentInteraction.reply({
						content: `${interaction.user.toString()} chose to end game early. The addon I was thinking of was ${
							addon.name
						}.`,
					});

					componentCollector.stop();
					messageCollector.stop();

					return;
				}

				if (!componentInteraction.isSelectMenu()) return;

				const selected = componentInteraction.values[0] || "";
				const split = selected.split(".");
				const question =
					questions[`${split[0] || ""}`]?.[+(split[1] || 0)]?.[+(split[2] || 0)] || "";
				const groupName = split[0] || selected;

				await componentInteraction.deferUpdate();

				await answerQuestion(question, groupName, split.length===3,split);

				componentCollector.resetTimer();
				messageCollector.resetTimer();
			})
			.on("end", async (collected) => {
				CURRENTLY_PLAYING.delete(interaction.user.id);

				await Promise.all([
					collected.size > 0 && componentCollector.endReason !== "GOT_CORRECT_ANSWER"
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
