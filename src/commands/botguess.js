/**
 * @file Command Where a player thinks of an addon and the bot asks questions about it and
 *   eventually guesses it.
 */
import { SlashCommandBuilder } from "@discordjs/builders";
import { Message, MessageActionRow, MessageButton, MessageEmbed, Util } from "discord.js";

import addons from "../common/addons.js";
import CONSTANTS from "../common/CONSTANTS.js";
import { CURRENTLY_PLAYING, checkIfUserPlaying } from "../common/gameUtils.js";
import manifest from "../common/manifest.js";
import questionsByAddon from "../common/questions.js";
import generateHash from "../lib/generateHash.js";

/**
 * Determine the best question to ask next.
 *
 * @param {[string, number][]} addonProbabilities - The probabilities of each addon being the answer.
 * @param {string[]} [askedQuestions] - Questions to ignore.
 *
 * @returns {string[] | undefined} - A new question to ask.
 */
function getNextQuestions(addonProbabilities, askedQuestions = []) {
	/** @type {{ [key: string]: number }} */
	const frequencies = {};

	for (const question of /**
	 * @type {{
	 * 	question: string;
	 * 	statement: string;
	 * 	dependencies?:
	 * 		| {
	 * 				[key: string]: boolean;
	 * 		  }
	 * 		| undefined;
	 * }[]}
	 */ (
		Object.entries(questionsByAddon)
			.map(([addon, questions]) =>
				Array.from({
					length: Math.round(
						((Array.from(addonProbabilities)
							.reverse()
							.findIndex(([id]) => id === addon) || 0) +
							1) /
							addonProbabilities.length +
							((addonProbabilities.find(([id]) => id === addon)?.[1] || 0) + 1),
					),
				}).fill(
					questions.filter(
						(questionInfo) => !askedQuestions.includes(questionInfo.question),
					),
				),
			)
			.flat(Number.POSITIVE_INFINITY)
	)) {
		frequencies[`${question.question}`] ??= 0;
		frequencies[`${question.question}`]++;
	}

	const frequenciesArray = Object.entries(frequencies);

	if (frequenciesArray.length === 0) return;

	return frequenciesArray
		.sort(() => Math.random() - 0.5)
		.reduce((previous, current, _, { length }) => {
			const currentDistance = Math.abs(current[1] / length - 0.5);
			const previousDistance = Math.abs((previous[0]?.[1] || 0) / length - 0.5);

			return currentDistance < previousDistance
				? current[1] < Math.round(length / 9)
					? []
					: [current]
				: currentDistance > previousDistance
				? previous
				: [...previous, current];
		}, /** @type {typeof frequenciesArray} */ ([]))
		.map(([question]) => question);
}

/**
 * Update probabilities based on an answered question.
 *
 * @param {string} justAsked - The question that was answered.
 * @param {number} probabilityShift - How much to care.
 * @param {[string, number][]} probabilitiesBefore - The probabilities of addons before this question.
 * @param {string[]} [askedQuestions] - Questions that were already asked. This function will be
 *   modify this array.
 *
 * @returns {[string, number][]} - The new probabilities.
 */
function answerQuestion(justAsked, probabilityShift, probabilitiesBefore, askedQuestions = []) {
	const justAskedQuestions = [justAsked];

	/** @type {{ [key: string]: boolean }} */
	const dependencies = {};
	const initialUpdated = probabilitiesBefore.map(([addonId, probability]) => {
		const addon = questionsByAddon[`${addonId}`];
		const questionInfo = addon?.find(({ question }) => question === justAsked);

		if (probabilityShift > 0 && questionInfo?.dependencies)
			Object.assign(dependencies, questionInfo.dependencies);

		const allDependencies =
			addon?.reduce(
				(accumulator, { dependencies: addonDependencies = {} }) => ({
					...accumulator,
					...addonDependencies,
				}),
				/** @type {{ [key: string]: boolean }} */ ({}),
			) || {};

		if (
			typeof allDependencies[`${justAsked}`] !== "undefined" &&
			((probabilityShift > 0 && !allDependencies[`${justAsked}`]) ||
				(probabilityShift < 0 && allDependencies[`${justAsked}`] !== false))
		) {
			if (addon) {
				justAskedQuestions.push(
					...addon
						.filter(({ dependencies: addonDependencies = {} }) =>
							Object.keys(addonDependencies)?.includes(justAsked),
						)
						.map(({ question }) => question),
				);
			}

			return /** @type {[string, number]} */ ([
				addonId,
				probability + (questionInfo ? probabilityShift : 0) - Math.abs(probabilityShift),
			]);
		}

		return /** @type {[string, number]} */ ([
			addonId,
			probability + (questionInfo ? probabilityShift : 0),
		]);
	});

	const result = Object.entries(dependencies)
		.reduce(
			(accumulated, current) =>
				askedQuestions.includes(current[0])
					? accumulated
					: answerQuestion(
							current[0],
							(current[1] ? +1 : -1) * probabilityShift,
							accumulated.sort((one, two) => two[1] - one[1]),
							askedQuestions,
					  ),
			initialUpdated,
		)
		.sort((one, two) => two[1] - one[1]);

	askedQuestions.push(...justAskedQuestions);

	return result;
}

/** @type {import("../../types/command").default} */
const info = {
	data: new SlashCommandBuilder().setDescription("You think of an addon and I guess!"),

	async interaction(interaction) {
		if (!(await checkIfUserPlaying(interaction))) {
			await interaction.reply({
				components: [
					new MessageActionRow().setComponents([
						new MessageButton()
							.setLabel("Please wait")
							.setStyle("SUCCESS")
							.setCustomId("wait")
							.setDisabled(true),
					]),
				],
			});
			await reply();

			/**
			 * Respond to an interaction with a question.
			 *
			 * @param {| import("discord.js").ButtonInteraction
			 * 	| import("discord.js").CommandInteraction} interaction
			 *   - The interaction to respond to.
			 *
			 * @param {string[]} [askedQuestions] - Questions to ignore.
			 * @param {[string, number][]} [addonProbabilities] - Current probabilities of each
			 *   addon being correct. MUST be sorted.
			 * @param {number} [askedCount] - Count of messages that have already been asked.
			 * @param {| false
			 * 	| string
			 * 	| {
			 * 			probabilities: [string, number][];
			 * 			askedQuestions: string[];
			 * 			justAsked: string;
			 * 	  }} [backInfo]
			 *   - Information about the previous question.
			 *
			 * @param justAnswered
			 *
			 * @returns {Promise<Message | undefined>} - Sent message.
			 */
			async function reply(
				askedQuestions = [],
				addonProbabilities = addons
					.map((addon) => /** @type {[string, number]} */ ([addon.id, 0]))
					.sort(() => Math.random() - 0.5),
				askedCount = 0,
				backInfo = false,
				justAnswered = "",
			) {
				const questions =
					typeof backInfo === "string"
						? [backInfo]
						: getNextQuestions(addonProbabilities, askedQuestions);

				const oldMessage = await interaction.fetchReply();

				if (process.env.NODE_ENV !== "production") {
					console.log(
						addonProbabilities[0],
						addonProbabilities[1],
						addonProbabilities[3],
					);
				}

				if (
					askedCount > 5 &&
					(addonProbabilities[1]?.[1] || 0) + 4 < (addonProbabilities[0]?.[1] || 0)
				) {
					await answerWithAddon(
						oldMessage,
						addonProbabilities,
						askedCount,
						askedQuestions,
						backInfo,justAnswered
					);

					return;
				}

				if (!questions?.[0]) {
					if ((addonProbabilities[1]?.[1] || 0) < (addonProbabilities[0]?.[1] || 0)) {
						await answerWithAddon(
							oldMessage,
							addonProbabilities,
							askedCount,
							askedQuestions,
							backInfo,justAnswered
						);

						return;
					}

					await oldMessage.reply({
						content: `You beat me! How *did* you do that? You were thinking of an actual addon, right? (Also, I only know about addons available in v${manifest.version})`,
					});

					CURRENTLY_PLAYING.delete(interaction.user.id);

					return;
				}

				const message = await interaction.editReply({
					components: [
						new MessageActionRow().addComponents(
							new MessageButton()
								.setLabel("Yes")
								.setStyle("SUCCESS")
								.setCustomId(generateHash("yes")),
							new MessageButton()
								.setLabel("I think so")
								.setStyle("SUCCESS")
								.setCustomId(generateHash("probably")),
							new MessageButton()
								.setLabel("I don’t know")
								.setStyle("PRIMARY")
								.setCustomId(generateHash("dontKnow")),
							new MessageButton()
								.setLabel("I don’t think so")
								.setStyle("DANGER")
								.setCustomId(generateHash("not")),
							new MessageButton()
								.setLabel("No")
								.setStyle("DANGER")
								.setCustomId(generateHash("no")),
						),
						new MessageActionRow().addComponents(
							...(typeof backInfo === "object"
								? [
										new MessageButton()
											.setLabel("Back")
											.setStyle("SECONDARY")
											.setCustomId(generateHash("back")),
								  ]
								: []),
							new MessageButton()
								.setLabel("End")
								.setStyle("SECONDARY")
								.setCustomId(generateHash("end")),
						),
					],

					content:
						(oldMessage.content ? `${oldMessage.content} **${justAnswered}**\n` : "") +
						questions[0],
				});

				if (!(message instanceof Message)) throw new TypeError("message is not a Message");

				CURRENTLY_PLAYING.set(interaction.user.id, message);

				const collector = message.createMessageComponentCollector({
					componentType: "BUTTON",

					filter: (buttonInteraction) =>
						buttonInteraction.user.id === interaction.user.id,

					time: 120_000,
				});

				collector
					.on("collect", async (buttonInteraction) => {
						if (buttonInteraction.customId.startsWith("end")) {
							CURRENTLY_PLAYING.delete(interaction.user.id);
							await Promise.all([
								buttonInteraction.reply({
									content: `${interaction.user.toString()} chose to end game early.`,
								}),
								interaction.editReply({
									components: message.components.map((row) =>
										row.setComponents(
											row.components.map((component) =>
												component.setDisabled(true),
											),
										),
									),

									content: message.content,
								}),
							]);

							collector.stop();

							return;
						}

						await buttonInteraction.deferUpdate();

						if (buttonInteraction.customId.startsWith("back")) {
							if (typeof backInfo !== "object") {
								await buttonInteraction.reply({
									content: "You can't go back here!",
									ephemeral: true,
								});
								collector.resetTimer();

								return;
							}

							const nextMessage = await reply(
								backInfo.askedQuestions,
								backInfo.probabilities,
								askedCount - 1,
								backInfo.justAsked,
								buttonInteraction.component.label || "",
							);

							if (nextMessage)
								CURRENTLY_PLAYING.set(interaction.user.id, nextMessage);
							else CURRENTLY_PLAYING.delete(interaction.user.id);

							collector.stop();
						} else {
							const probabilityShift = buttonInteraction.customId.startsWith("yes")
								? 2
								: buttonInteraction.customId.startsWith("probably")
								? 1
								: buttonInteraction.customId.startsWith("not")
								? -1
								: buttonInteraction.customId.startsWith("no")
								? -2
								: 0;

							const previouslyAsked = Array.from(askedQuestions);
							const newProbabilities = answerQuestion(
								questions[0] || "",
								probabilityShift,
								addonProbabilities,
								askedQuestions,
							);

							const nextMessage = await reply(
								askedQuestions,
								newProbabilities,
								askedCount + 1,
								{
									askedQuestions: previouslyAsked,
									justAsked: questions[0] || "",
									probabilities: addonProbabilities,
								},
								buttonInteraction.component.label || "",
							);

							if (nextMessage)
								CURRENTLY_PLAYING.set(interaction.user.id, nextMessage);
							else CURRENTLY_PLAYING.delete(interaction.user.id);

							collector.stop();
						}
					})
					.on("end", async (collected) => {
						if (collected.size === 0) {
							CURRENTLY_PLAYING.delete(interaction.user.id);
							await Promise.all([
								interaction.followUp(
									`${interaction.user.toString()}, you didn’t answer my question! I’m going to end the game.`,
								),
								interaction.editReply({
									components: message.components.map((row) =>
										row.setComponents(
											row.components.map((component) =>
												component.setDisabled(true),
											),
										),
									),

									content: message.content,
								}),
							]);
						}
					});

				return message;
			}

			/**
			 * Reply to an interaction with an embed saying that the addon has been guessed and a
			 * button to keep playing.
			 *
			 * @param {import("discord.js").Message} oldMessage - Interaction to reply to.
			 * @param {[string, number][]} addonProbabilities - The probabilities of each addon being correct.
			 * @param {number} askedCount - How many questions have been asked already.
			 * @param {string[]} askedQuestions - Questions that should not be asked.
			 * @param {| false
			 * 	| string
			 * 	| {
			 * 			probabilities: [string, number][];
			 * 			askedQuestions: string[];
			 * 			justAsked: string;
			 * 	  }} backInfo
			 *   - Information about the previous question.
			 */
			async function answerWithAddon(
				oldMessage,
				addonProbabilities,
				askedCount,
				askedQuestions,
				backInfo,
				justAnswered=""
			) {
				const foundAddon = addons.find(({ id }) => id === addonProbabilities[0]?.[0]);

				if (!foundAddon) {
					throw new ReferenceError(
						`Addon ${
							addonProbabilities[0]?.[0] || ""
						} referenced in addonProbabilities not found in addons!`,
					);
				}

				const nextChoice = addons.find(({ id }) => id === addonProbabilities[1]?.[0])?.name;

				await oldMessage.edit({
					components: [
						new MessageActionRow().addComponents(
							new MessageButton()
								.setLabel("Yes")
								.setStyle("SUCCESS")
								.setCustomId(generateHash("yes"))
								.setDisabled(true),
							new MessageButton()
								.setLabel("I think so")
								.setStyle("SUCCESS")
								.setCustomId(generateHash("probably"))
								.setDisabled(true),
							new MessageButton()
								.setLabel("I don’t know")
								.setStyle("PRIMARY")
								.setCustomId(generateHash("dontKnow"))
								.setDisabled(true),
							new MessageButton()
								.setLabel("I don’t think so")
								.setStyle("DANGER")
								.setCustomId(generateHash("not"))
								.setDisabled(true),
							new MessageButton()
								.setLabel("No")
								.setStyle("DANGER")
								.setCustomId(generateHash("no"))
								.setDisabled(true),
						),
						new MessageActionRow().addComponents(
							...(typeof backInfo === "object"
								? [
										new MessageButton()
											.setLabel("Back")
											.setStyle("SECONDARY")
											.setCustomId(generateHash("back"))
											.setDisabled(true),
								  ]
								: []),
							new MessageButton()
								.setLabel("End")
								.setStyle("SECONDARY")
								.setCustomId(generateHash("end"))
								.setDisabled(true),
						),
					],

					content:( oldMessage.content
						? `${oldMessage.content} **${justAnswered}**\n`
						: "")+`Is it the **${foundAddon.name}** addon?`,
				});

				const message = await oldMessage.reply({
					components: [
						new MessageActionRow().addComponents(
							...(typeof backInfo === "object"
								? [
										new MessageButton()
											.setLabel("Back")
											.setStyle("SECONDARY")
											.setCustomId(generateHash("back")),
								  ]
								: []),

							new MessageButton()
								.setLabel("No it’s not, continue!")
								.setStyle("PRIMARY")
								.setCustomId(generateHash("continue")),
						),
					],

					content: `${interaction.user.toString()}, your addon is **${Util.escapeMarkdown(
						foundAddon.name,
					)}**!`,

					embeds: [
						new MessageEmbed()
							.setTitle(foundAddon.name)
							.setDescription(
								`${
									Object.entries(questionsByAddon)
										.find(([id]) => id === addonProbabilities[0]?.[0])?.[1]
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
									foundAddon.id,
								)}.png`,
							)
							.setURL(
								`https://scratch.mit.edu/scratch-addons-extension/settings#addon-${encodeURIComponent(
									foundAddon.id,
								)}`,
							)
							.setFooter({
								text: `Guessed after ${askedCount} questions.${
									CONSTANTS.footerSeperator
								}Probability: ${addonProbabilities[0]?.[1]}${
									nextChoice
										? `${CONSTANTS.footerSeperator}Next choice: ${nextChoice} (probability ${addonProbabilities[1]?.[1]})`
										: ""
								}`,
							}),
					],

					fetchReply: true,
				});

				if (!(message instanceof Message)) throw new TypeError("message is not a Message");

				CURRENTLY_PLAYING.delete(interaction.user.id);

				const collector = message.createMessageComponentCollector({
					componentType: "BUTTON",

					filter: (buttonInteraction) =>
						buttonInteraction.user.id === interaction.user.id,

					max: 1,
					time: 30_000,
				});

				collector
					.on("collect", async (buttonInteraction) => {
						if (await checkIfUserPlaying(buttonInteraction)) return;

						if (buttonInteraction.customId.startsWith("back")) {
							if (typeof backInfo !== "object") {
								await buttonInteraction.reply({
									content: `${interaction.user.toString()}, you can't go back here!`,
									ephemeral: true,
								});
								collector.resetTimer();

								return;
							}

							await buttonInteraction.deferUpdate();

							const nextMessage = await reply(
								backInfo.askedQuestions,
								backInfo.probabilities,
								askedCount - 1,
								backInfo.justAsked,buttonInteraction.component.label||""
							);

							if (nextMessage)
								CURRENTLY_PLAYING.set(interaction.user.id, nextMessage);

							return;
						}

						await buttonInteraction.deferUpdate();

						const nextMessage = await reply(
							askedQuestions,
							addonProbabilities.slice(1),
							askedCount + 1,false,"No"
						);

						if (nextMessage) CURRENTLY_PLAYING.set(interaction.user.id, nextMessage);
					})
					.on("end", async () => {
						CURRENTLY_PLAYING.delete(interaction.user.id);
						await message.edit({
							components: message.components.map((row) =>
								row.setComponents(
									row.components.map((component) => component.setDisabled(true)),
								),
							),

							content: message.content,
						});
					});
			}
		}
	},
};

export default info;
