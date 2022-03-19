/** @file Command To get information about an addon. */
import { SlashCommandBuilder } from "@discordjs/builders";
import { Collection, Message, MessageActionRow, MessageButton } from "discord.js";
import fetch from "node-fetch";

import CONSTANTS from "../CONSTANTS.js";
import generateHash from "../lib/generateHash.js";

/** @type {Collection<string, Message>} */
const CURRENTLY_PLAYING = new Collection();

const manifestPromise = fetch(`${CONSTANTS.repository}/manifest.json`).then(
	async (response) => await /** @type {Promise<chrome.runtime.ManifestV2>} */ (response.json()),
);
const addonIds = await fetch(`${CONSTANTS.repository}/addons/addons.json`).then(
	async (response) => await /** @type {Promise<string[]>} */ (response.json()),
);
const addonPromises = [];

for (const addonId of addonIds.filter((item) => !item.startsWith("//"))) {
	addonPromises.push(
		fetch(`${CONSTANTS.repository}/addons/${addonId}/addon.json`).then(async (response) => ({
			...(await /** @type {Promise<import("../../types/addonManifest").default>} */ (
				response.json()
			)),

			id: addonId,
		})),
	);
}

const [addons, manifest] = await Promise.all([Promise.all(addonPromises), manifestPromise]);

const QUESTIONS = {
	categories: {
		easterEgg: "is this addon a easter egg addon (shown after typing the Konami code)?",

		editor: {
			code: "is this addon listed under 'Scratch Editor Features' -> 'Code Editor'?",
			costumes: "is this addon listed under 'Scratch Editor Features' -> 'Costume Editor'?",
			other: "is this addon listed under 'Scratch Editor Features' -> 'Others'?",
			player: "is this addon listed under 'Scratch Editor Features' -> 'Project Player'?",
			root: "is this addon listed under 'Scratch Editor Features'?",
		},

		popup: "is this addon listed under 'Extension Popup Features'?",
		themes: "is this addon listed under 'Themes'?",

		website: {
			forums: "is this addon listed under 'Scratch Website Features' -> 'Forums'?",
			other: "is this addon listed under 'Scratch Website Features' -> 'Others'?",
			profiles: "is this addon listed under 'Scratch Website Features' -> 'Profiles'?",
			projects: "is this addon listed under 'Scratch Website Features' -> 'Project Pages'?",
			root: "is this addon listed under 'Scratch Website Features'?",
		},
	},

	groups: {
		beta: "is this addon found under 'Beta' when disabled?",
		featured: "is this addon found under 'Featured' when disabled?",
		forums: "is this addon found under 'Forums' when disabled?",
		others: "is this addon found under 'Others' when disabled?",
	},

	history: {
		new: `was this addon added in the latest version (${
			manifest.version_name || manifest.version
		})?`,

		updated: `was this addon updated (not including completely new addons) in the latest version (${
			manifest.version_name || manifest.version
		})?`,
	},

	settings: {
		credits: "does this addon have credits listed on the settings page?",
		enabledDefault: "is this addon enabled by default?",
		info: "does this addon have any warnings or notices on the settings page?",
		presets: "does this addon have any presets for its settings?",
		preview: "does this addon have an interactive preview for its settings?",
		settings: "does this addon have any settings?",
	},

	tags: {
		beta: "does this addon have the 'Beta' tag?",
		dangerous: "does this addon have the 'Dangerous' tag?",
		forums: "does this addon have the 'Forums' tag?",
		recommended: "does this addon have the 'Recommended' tag?",
	},
};

const firstLetters = Object.fromEntries(
	addons.map((addon) => [
		`does this addon's name start with ${addon.name.at(0)?.toUpperCase() || ""}?`,
		false,
	]),
);

const forceEasterEggs = new Set(["cat-blocks"]);

const questionsByAddon = addons.map((addon) => {
	/** @type {{ question: string; dependencies?: { [key: string]: boolean } }[]} */
	const result = [];

	if (addon.enabledByDefault) result.push({ question: QUESTIONS.settings.enabledDefault });

	if (addon.info) result.push({ question: QUESTIONS.settings.info });

	if (addon.addonPreview) {
		result.push({
			dependencies: { [QUESTIONS.settings.settings]: true },
			question: QUESTIONS.settings.preview,
		});
	}

	if (addon.credits) result.push({ question: QUESTIONS.settings.credits });

	if (addon.presets) {
		result.push({
			dependencies: { [QUESTIONS.settings.settings]: true },
			question: QUESTIONS.settings.presets,
		});
	}

	if (addon.settings) result.push({ question: QUESTIONS.settings.settings });

	result.push({
		dependencies: Object.fromEntries(
			Object.entries(firstLetters).filter(
				(question) =>
					question[0] !==
					`does this addon's name start with ${addon.name.at(0)?.toUpperCase() || ""}?`,
			),
		),

		question: `does this addon's name start with ${addon.name.at(0)?.toUpperCase() || ""}?`,
	});

	const category = addon.tags.includes("popup")
		? "popup"
		: addon.tags.includes("easterEgg")
		? "easterEgg"
		: addon.tags.includes("theme")
		? "theme"
		: addon.tags.includes("community")
		? "community"
		: "editor";

	switch (category) {
		case "theme": {
			result.push(
				{
					dependencies: {
						[QUESTIONS.categories.editor.root]: false,
						[QUESTIONS.categories.website.root]: false,
						[QUESTIONS.categories.popup]: false,
						[QUESTIONS.categories.easterEgg]: forceEasterEggs.has(addon.id),
					},

					question: QUESTIONS.categories.themes,
				},
				{
					dependencies: {
						[QUESTIONS.categories.themes]: true,

						[`is this addon listed under 'Themes' -> '${
							addon.tags.includes("editor") ? "Website" : "Editor"
						} Themes'?`]: false,
					},

					question: `is this addon listed under 'Themes' -> '${
						addon.tags.includes("editor") ? "Editor" : "Website"
					} Themes'?`,
				},
			);

			break;
		}
		case "editor": {
			result.push({
				dependencies: {
					[QUESTIONS.categories.themes]: false,
					[QUESTIONS.categories.website.root]: false,
					[QUESTIONS.categories.popup]: false,
					[QUESTIONS.categories.easterEgg]: forceEasterEggs.has(addon.id),
				},

				question: QUESTIONS.categories.editor.root,
			});

			if (addon.tags.includes("codeEditor")) {
				result.push({
					dependencies: {
						[QUESTIONS.categories.editor.root]: true,
						[QUESTIONS.categories.editor.other]: false,
						[QUESTIONS.categories.editor.costumes]: false,
						[QUESTIONS.categories.editor.player]: false,
					},

					question: QUESTIONS.categories.editor.code,
				});
			} else if (addon.tags.includes("costumeEditor")) {
				result.push({
					dependencies: {
						[QUESTIONS.categories.editor.root]: true,
						[QUESTIONS.categories.editor.code]: false,
						[QUESTIONS.categories.editor.other]: false,
						[QUESTIONS.categories.editor.player]: false,
					},

					question: QUESTIONS.categories.editor.costumes,
				});
			} else if (addon.tags.includes("projectPlayer")) {
				result.push({
					dependencies: {
						[QUESTIONS.categories.editor.root]: true,
						[QUESTIONS.categories.editor.code]: false,
						[QUESTIONS.categories.editor.costumes]: false,
						[QUESTIONS.categories.editor.other]: false,
					},

					question: QUESTIONS.categories.editor.player,
				});
			} else {
				result.push({
					dependencies: {
						[QUESTIONS.categories.editor.root]: true,
						[QUESTIONS.categories.editor.code]: false,
						[QUESTIONS.categories.editor.costumes]: false,
						[QUESTIONS.categories.editor.player]: false,
					},

					question: QUESTIONS.categories.editor.other,
				});
			}

			break;
		}
		case "community": {
			if (addon.tags.includes("profiles")) {
				result.push({
					dependencies: {
						[QUESTIONS.categories.website.root]: true,
						[QUESTIONS.categories.website.other]: false,
						[QUESTIONS.categories.website.projects]: false,
						[QUESTIONS.categories.website.forums]: false,
					},

					question: QUESTIONS.categories.website.profiles,
				});
			} else if (addon.tags.includes("projectPage")) {
				result.push({
					dependencies: {
						[QUESTIONS.categories.website.root]: true,
						[QUESTIONS.categories.website.profiles]: false,
						[QUESTIONS.categories.website.other]: false,
						[QUESTIONS.categories.website.forums]: false,
					},

					question: QUESTIONS.categories.website.projects,
				});
			} else if (addon.tags.includes("forums")) {
				result.push({
					dependencies: {
						[QUESTIONS.categories.website.root]: true,
						[QUESTIONS.categories.website.profiles]: false,
						[QUESTIONS.categories.website.projects]: false,
						[QUESTIONS.categories.website.other]: false,
					},

					question: QUESTIONS.categories.website.forums,
				});
			} else {
				result.push({
					dependencies: {
						[QUESTIONS.categories.website.root]: true,
						[QUESTIONS.categories.website.profiles]: false,
						[QUESTIONS.categories.website.projects]: false,
						[QUESTIONS.categories.website.forums]: false,
					},

					question: QUESTIONS.categories.website.other,
				});
			}

			result.push({
				dependencies: {
					[QUESTIONS.categories.themes]: false,
					[QUESTIONS.categories.editor.root]: false,
					[QUESTIONS.categories.popup]: false,
				},

				question: QUESTIONS.categories.website.root,
			});

			break;
		}
		case "popup": {
			result.push({
				dependencies: {
					[QUESTIONS.categories.themes]: false,
					[QUESTIONS.categories.editor.root]: false,
					[QUESTIONS.categories.website.root]: false,
				},

				question: QUESTIONS.categories.popup,
			});

			break;
		}
		case "easterEgg": {
			result.push({
				dependencies: {
					[QUESTIONS.categories.themes]: false,
					[QUESTIONS.categories.popup]: false,
					[QUESTIONS.categories.editor.root]: false,
					[QUESTIONS.categories.website.root]: false,
				},

				question: QUESTIONS.categories.easterEgg,
			});

			break;
		}
	}

	if (forceEasterEggs.has(addon.id)) {
		result.push({
			question: QUESTIONS.categories.easterEgg,
		});
	}

	const [extensionMajor, extensionMinor] = manifest.version.split(".");

	if (addon.versionAdded) {
		const [addonMajor, addonMinor] = addon.versionAdded.split(".");

		if (extensionMajor === addonMajor && extensionMinor === addonMinor) {
			result.push(
				{ question: QUESTIONS.history.new },
				{
					dependencies: { [QUESTIONS.history.new]: true },

					question: `is this addon currently found under '${
						addon.tags.includes("recommended") || addon.tags.includes("featured")
							? "Featured"
							: "Other"
					} new addons and updates'?`,
				},
			);
		}
	}

	if (addon.latestUpdate) {
		const [addonMajor, addonMinor] = addon.latestUpdate.version.split(".");

		if (extensionMajor === addonMajor && extensionMinor === addonMinor) {
			result.push(
				{ question: QUESTIONS.history.updated },
				{
					dependencies: { [QUESTIONS.history.updated]: true },

					question: `does this addon have the '${
						manifest.latestUpdate.newSettings?.length ? "New settings" : "New features"
					}' tag?`,
				},
				{
					dependencies: { [QUESTIONS.history.updated]: true },

					question: `is this addon currently found under '${
						manifest.latestUpdate.isMajor ? "Featured" : "Other"
					} new addons and updates'?`,
				},
			);
		}
	}

	if (addon.tags.includes("featured")) {
		result.push({
			dependencies: {
				[QUESTIONS.groups.beta]: false,
				[QUESTIONS.groups.forums]: false,
				[QUESTIONS.groups.others]: false,
			},

			question: QUESTIONS.groups.featured,
		});
	} else if (addon.tags.includes("beta") || addon.tags.includes("danger")) {
		result.push({
			dependencies: {
				[QUESTIONS.groups.featured]: false,
				[QUESTIONS.groups.forums]: false,
				[QUESTIONS.groups.others]: false,
			},

			question: QUESTIONS.groups.beta,
		});
	} else if (addon.tags.includes("forums")) {
		result.push({
			dependencies: {
				[QUESTIONS.groups.featured]: false,
				[QUESTIONS.groups.beta]: false,
				[QUESTIONS.tags.forums]: true,
				[QUESTIONS.groups.others]: false,
			},

			question: QUESTIONS.groups.forums,
		});
	} else {
		result.push({
			dependencies: {
				[QUESTIONS.groups.featured]: false,
				[QUESTIONS.groups.beta]: false,
				[QUESTIONS.groups.forums]: false,
				[QUESTIONS.tags.forums]: false,
			},

			question: QUESTIONS.groups.others,
		});
	}

	if (addon.tags.includes("danger")) {
		result.push({
			dependencies: { [QUESTIONS.groups.beta]: true },
			question: QUESTIONS.tags.dangerous,
		});
	}

	if (addon.tags.includes("forums")) {
		result.push({
			dependencies: { [QUESTIONS.groups.others]: false },
			question: QUESTIONS.tags.forums,
		});
	}

	if (addon.tags.includes("recommended")) result.push({ question: QUESTIONS.tags.recommended });

	if (addon.tags.includes("beta")) {
		result.push({
			dependencies: { [QUESTIONS.groups.beta]: true },
			question: QUESTIONS.tags.beta,
		});
	}

	return /** @type {[string, typeof result]} */ ([addon.id, result]);
});

const allQuestions = questionsByAddon.flatMap(([, addonQuestions]) => addonQuestions);

/**
 * Determine the best question to ask next.
 *
 * @param {string[]} [askedQuestions] - Questions to ignore.
 *
 * @returns {string | undefined} - A new question to ask.
 */
function getNextQuestion(askedQuestions = []) {
	/** @type {{ [key: string]: number }} */
	const frequencies = {};

	for (const question of allQuestions.filter(
		(questionInfo) => !askedQuestions.includes(questionInfo.question),
	)) {
		frequencies[`${question.question}`] ??= 0;
		frequencies[`${question.question}`]++;
	}

	const frequenciesArray = Object.entries(frequencies);

	return frequenciesArray.length > 0
		? frequenciesArray.reduce((previous, current, _, { length }) =>
				Math.abs(current[1] / length - 0.5) < Math.abs(previous[1] / length - 0.5)
					? current
					: previous,
		  )[0]
		: undefined;
}

/**
 * Update probabilities based on an answered question.
 *
 * @param {string} justAsked - The question that was answered.
 * @param {number} probabilityShift - How much to care.
 * @param {[string, number][]} probabilitiesBefore - The probabilities of addons before this question.
 * @param {string[]} askedQuestions - Questions that were already asked. This function will be
 *   modify this array.
 *
 * @returns {[string, number][]} - The new probabilities.
 */
function answerQuestion(justAsked, probabilityShift, probabilitiesBefore, askedQuestions = []) {
	const justAskedQuestions = [justAsked];

	/** @type {{ [key: string]: boolean }} */
	const dependencies = {};
	const initialUpdated = probabilitiesBefore.map(([addonId, probability]) => {
		const addon = Object.fromEntries(questionsByAddon)[`${addonId}`];
		const questionInfo = addon?.find(({ question }) => question === justAsked);

		if (probabilityShift > 0 && questionInfo?.dependencies)
			Object.assign(dependencies, questionInfo.dependencies);

		const allDependencies =
			addon?.reduce(
				(accumulator, { dependencies: addonDependencies = {} }) => ({
					...accumulator,
					...addonDependencies,
				}),
				/**
				 * @type {{
				 * 	[key: string]: boolean;
				 * }}
				 */ ({}),
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
							accumulated,
							askedQuestions,
					  ),
			initialUpdated,
		)
		.sort((one, two) => two[1] - one[1]);

	askedQuestions.push(...justAskedQuestions);

	return result;
}

/**
 * Respond to an interaction with a question.
 *
 * @param {import("discord.js").ButtonInteraction | import("discord.js").CommandInteraction} interaction
 *   - The interaction to respond to.
 *
 * @param {string[]} [askedQuestions] - Questions to ignore.
 * @param {[string, number][]} addonProbabilities - Current probabilities of each addon being correct.
 *
 * @returns {Promise<Message | undefined>} - Sent message.
 */
async function reply(
	interaction,
	askedQuestions = [],
	addonProbabilities = addons.map((addon) => /** @type {[string, number]} */ ([addon.id, 0])),
) {
	const question = getNextQuestion(askedQuestions);

	if (!question) {
		await interaction.reply({ content: "I have no more questions." });

		return;
	}

	const message = await interaction.reply({
		components: [
			new MessageActionRow().addComponents(
				new MessageButton()
					.setLabel("Yes")
					.setStyle("SUCCESS")
					.setCustomId(generateHash("yes")),
				new MessageButton()
					.setLabel("Probably")
					.setStyle("PRIMARY")
					.setCustomId(generateHash("probably")),
				new MessageButton()
					.setLabel("I don't know")
					.setStyle("SECONDARY")
					.setCustomId(generateHash("dontKnow")),
				new MessageButton()
					.setLabel("Probably not")
					.setStyle("DANGER")
					.setCustomId(generateHash("not")),
				new MessageButton()
					.setLabel("No")
					.setStyle("DANGER")
					.setCustomId(generateHash("no")),
			),
			new MessageActionRow().addComponents(
				new MessageButton()
					.setLabel("End")
					.setStyle("SECONDARY")
					.setCustomId(generateHash("end")),
			),
		],

		content: `${interaction.user.toString()}, ${question}`,
		fetchReply: true,
	});

	if (!(message instanceof Message)) throw new TypeError("message is not a Message");

	message
		.createMessageComponentCollector({
			componentType: "BUTTON",
			filter: (buttonInteraction) => buttonInteraction.user.id === interaction.user.id,
			max: 1,
			time: 120_000,
		})
		.on("collect", async (buttonInteraction) => {
			if (buttonInteraction.customId.startsWith("end")) {
				CURRENTLY_PLAYING.delete(interaction.user.id);
				await buttonInteraction.reply({
					content: `${interaction.user.toString()} chose to end game early.`,
				});
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

				const newProbabilities = answerQuestion(
					question,
					probabilityShift,
					addonProbabilities,
					askedQuestions,
				);

				await interaction.channel?.send(JSON.stringify(newProbabilities[0]));

				const nextMessage = await reply(
					buttonInteraction,
					askedQuestions,
					newProbabilities,
				);

				if (nextMessage) CURRENTLY_PLAYING.set(interaction.user.id, nextMessage);
			}
		})
		.on("end", async (collected) => {
			const buttonPromises = [];

			if (collected.size === 0) {
				CURRENTLY_PLAYING.delete(interaction.user.id);
				buttonPromises.push(
					message.reply(
						`${interaction.user.toString()}, timed out: no answer was given.`,
					),
				);
			}

			await Promise.all([
				...buttonPromises,
				interaction.editReply({
					components: message.components.map((rows) =>
						rows.type === "ACTION_ROW"
							? rows.setComponents(
									rows.components.map((component) => component.setDisabled(true)),
							  )
							: rows,
					),

					content: message.content,
				}),
			]);
		});

	return message;
}

/** @type {import("../../types/command").default} */
const info = {
	data: new SlashCommandBuilder().setDescription(
		"Replies with information about a specific addon.",
	),

	async interaction(interaction) {
		const current = CURRENTLY_PLAYING.get(interaction.user.id);

		if (current) {
			await interaction.reply({
				components: [
					new MessageActionRow().addComponents(
						new MessageButton()
							.setLabel("Go to game")
							.setStyle("LINK")
							.setURL(
								`https://discord.com/channels/${current.guild?.id || "@me"}/${
									current.channel.id
								}/${current.id}`,
							),
					),
				],

				content: "You already have an ongoing game!",
				ephemeral: true,
			});

			return;
		}

		const message = await reply(interaction);

		if (message) CURRENTLY_PLAYING.set(interaction.user.id, message);
	},
};

export default info;
