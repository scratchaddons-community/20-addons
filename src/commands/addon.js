/** @file Command To get information about an addon. */
import { SlashCommandBuilder } from "@discordjs/builders";
import { Collection, Message, MessageActionRow, MessageButton, Util } from "discord.js";
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
		fetch(`${CONSTANTS.repository}/addons/${encodeURIComponent(addonId)}/addon.json`).then(
			async (response) => ({
				...(await /** @type {Promise<import("../../types/addonManifest").default>} */ (
					response.json()
				)),

				id: addonId,
			}),
		),
	);
}

const [addons, manifest] = await Promise.all([Promise.all(addonPromises), manifestPromise]);

/**
 * @param {string} full
 *
 * @returns {string}
 */
function getVersion(full) {
	return /^(?<main>\d+\.\d+)\.\d+/.exec(full).groups?.main || "";
}

const version = getVersion(manifest.version);

const QUESTIONS = {
	categories: {
		easterEgg: "is your addon a easter egg addon (shown after typing the Konami code)?",

		editor: {
			code: "is your addon listed under **Scratch Editor Features** -> **Code Editor**?",

			costumes:
				"is your addon listed under **Scratch Editor Features** -> **Costume Editor**?",

			other: "is your addon listed under **Scratch Editor Features** -> **Others**?",
			player: "is your addon listed under **Scratch Editor Features** -> **Project Player**?",
			root: "is your addon listed under **Scratch Editor Features**?",
		},

		popup: "is your addon listed under **Extension Popup Features**?",
		themes: "is your addon listed under **Themes**?",

		website: {
			forums: "is your addon listed under **Scratch Website Features** -> **Forums**?",
			other: "is your addon listed under **Scratch Website Features** -> **Others**?",

			profiles: "is your addon listed under **Scratch Website Features** -> **Profiles**?",

			projects:
				"is your addon listed under **Scratch Website Features** -> **Project Pages**?",

			root: "is your addon listed under **Scratch Website Features**?",
		},
	},

	groups: {
		beta: "is your addon found under **Beta** when disabled?",
		featured: "is your addon found under **Featured** when disabled?",
		forums: "is your addon found under **Forums** when disabled?",
		others: "is your addon found under **Others** when disabled?",
	},

	history: {
		new: `was your addon added in the latest version (**[${Util.escapeMarkdown(
			version,
		)}](https://github.com/ScratchAddons/ScratchAddons/releases/tag/v${version}.0)**)?`,

		updated: `was your addon updated (not including completely new addons) in the latest version (**[${Util.escapeMarkdown(
			version,
		)}](https://github.com/ScratchAddons/ScratchAddons/releases/tag/v${version}.0)**)?`,
	},

	settings: {
		credits: "does your addon have credits listed on the settings page?",
		enabledDefault: "is your addon enabled by default?",
		info: "does your addon have any warnings or notices on the settings page?",
		presets: "does your addon have any presets for its settings?",
		preview: "does your addon have an interactive preview for its settings?",
		settings: "does your addon have any settings?",
	},

	tags: {
		beta: "does your addon have the **Beta** tag?",
		dangerous: "does your addon have the **Dangerous** tag?",
		forums: "does your addon have the **Forums** tag?",
		recommended: "does your addon have the **Recommended** tag?",
	},
};

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

	if (addon.credits) {
		result.push(
			{ question: QUESTIONS.settings.credits },
			...addon.credits.map(({ name }) => ({
				dependencies: { [QUESTIONS.settings.credits]: true },
				question: `did **${name}** contribute to your addon?`,
			})),
		);
	}

	if (addon.presets) {
		result.push({
			dependencies: { [QUESTIONS.settings.settings]: true },
			question: QUESTIONS.settings.presets,
		});
	}

	if (addon.settings) result.push({ question: QUESTIONS.settings.settings });

	result.push(
		{
			dependencies: Object.fromEntries(
				addons
					.map((addon) => [
						`does your addon’s name **start** with **${Util.escapeMarkdown(
							addon.name.at(0)?.toUpperCase() || "",
						)}**?`,
						false,
					])
					.filter(
						(question) =>
							question[0] !==
							`does your addon’s name **start** with **${Util.escapeMarkdown(
								addon.name.at(0)?.toUpperCase() || "",
							)}**?`,
					),
			),

			question: `does your addon’s name **start** with **${Util.escapeMarkdown(
				addon.name.at(0)?.toUpperCase() || "",
			)}**?`,
		},
		{
			dependencies: Object.fromEntries(
				addons
					.map((addon) => [
						`does your addon’s name **end** with **${Util.escapeMarkdown(
							addon.name.at(-1)?.toUpperCase() || "",
						)}**?`,
						false,
					])
					.filter(
						(question) =>
							question[0] !==
							`does your addon’s name **end** with **${Util.escapeMarkdown(
								addon.name.at(-1)?.toUpperCase() || "",
							)}**?`,
					),
			),

			question: `does your addon’s name **end** with **${Util.escapeMarkdown(
				addon.name.at(-1)?.toUpperCase() || "",
			)}**?`,
		},
	);

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

						[`is your addon listed under **Themes** -> **${
							addon.tags.includes("editor") ? "Website" : "Editor"
						} Themes**?`]: false,
					},

					question: `is your addon listed under **Themes** -> **${
						addon.tags.includes("editor") ? "Editor" : "Website"
					} Themes**?`,
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

	if (addon.versionAdded && version === getVersion(addon.versionAdded)) {
		result.push(
			{ question: QUESTIONS.history.new },
			{
				dependencies: {
					[QUESTIONS.history.new]: true,

					[`is your addon found under **${
						addon.tags.includes("recommended") || addon.tags.includes("featured")
							? "Other"
							: "Featured"
					} new addons and updates** as of version **[${Util.escapeMarkdown(
						version,
					)}](https://github.com/ScratchAddons/ScratchAddons/releases/tag/v${version}.0)**?`]: false,
				},

				question: `is your addon found under **${
					addon.tags.includes("recommended") || addon.tags.includes("featured")
						? "Featured"
						: "Other"
				} new addons and updates** as of version **[${Util.escapeMarkdown(
					version,
				)}](https://github.com/ScratchAddons/ScratchAddons/releases/tag/v${version}.0)**?`,
			},
		);
	}

	if (addon.latestUpdate && version === getVersion(addon.latestUpdate.version)) {
		result.push(
			{ question: QUESTIONS.history.updated },
			{
				dependencies: {
					[QUESTIONS.history.updated]: true,

					[`does your addon have the **${
						manifest.latestUpdate.newSettings?.length ? "New features" : "New settings"
					}** tag?`]: false,
				},

				question: `does your addon have the **${
					manifest.latestUpdate.newSettings?.length ? "New settings" : "New features"
				}** tag?`,
			},
			{
				dependencies: {
					[QUESTIONS.history.updated]: true,

					[`is your addon found under **${
						manifest.latestUpdate.isMajor ? "Other" : "Featured"
					} new addons and updates**’ as of **[${Util.escapeMarkdown(
						version,
					)}](https://github.com/ScratchAddons/ScratchAddons/releases/tag/v${version}.0)**?`]: false,
				},

				question: `is your addon found under **${
					manifest.latestUpdate.isMajor ? "Featured" : "Other"
				} new addons and updates**’ as of **[${Util.escapeMarkdown(
					version,
				)}](https://github.com/ScratchAddons/ScratchAddons/releases/tag/v${version}.0)**?`,
			},
		);
	}

	if (addon.tags.includes("recommended")) {
		result.push({
			dependencies: {
				[QUESTIONS.groups.featured]: false,
				[QUESTIONS.groups.beta]: false,
				[QUESTIONS.groups.others]: false,
			},

			question: QUESTIONS.tags.recommended,
		});
	} else if (addon.tags.includes("featured")) {
		result.push({
			dependencies: {
				[QUESTIONS.groups.beta]: false,
				[QUESTIONS.groups.forums]: false,
				[QUESTIONS.groups.others]: false,
				[QUESTIONS.tags.recommended]: false,
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

	if (addon.tags.includes("beta")) {
		result.push({
			dependencies: { [QUESTIONS.groups.beta]: true },
			question: QUESTIONS.tags.beta,
		});
	}

	return /** @type {[string, typeof result]} */ ([addon.id, result]);
});

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

	for (const question of questionsByAddon
		.map(([addon, questions]) =>
			Array.from({
				length: Math.round(
					Math.max(
						((addonProbabilities.find(([id]) => id === addon)?.[1] || 0) -
							(addonProbabilities.at(-1)?.[1] || 0)) /
							7.5,
						1,
					),
				),
			}).fill(
				questions.filter((questionInfo) => !askedQuestions.includes(questionInfo.question)),
			),
		)
		.flat(Number.POSITIVE_INFINITY)) {
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
				? [current]
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
							accumulated.sort((one, two) => two[1] - one[1]),
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
 * @param {[string, number][]} [addonProbabilities] - Current probabilities of each addon being
 *   correct. MUST be sorted.
 * @param {number} [askedCount] - Count of messages that have already been asked.
 *
 * @returns {Promise<Message | undefined>} - Sent message.
 */
async function reply(
	interaction,
	askedQuestions = [],
	addonProbabilities = addons.map((addon) => /** @type {[string, number]} */ ([addon.id, 0])),
	askedCount = 0,
) {
	const questions = getNextQuestions(addonProbabilities, askedQuestions);

	if (process.env.NODE_ENV !== "production")
		console.log(addonProbabilities[0], addonProbabilities[1], addonProbabilities[3]);

	if (
		askedCount > 9 &&
		(addonProbabilities[1]?.[1] || 0) + 4 < (addonProbabilities[0]?.[1] || 0)
	) {
		const message = await interaction.reply({
			components: [
				new MessageActionRow().addComponents(
					new MessageButton()
						.setLabel("No it’s not, continue!")
						.setStyle("PRIMARY")
						.setCustomId(generateHash("continue")),
				),
			],

			content: `${interaction.user.toString()}, your addon is **${Util.escapeMarkdown(
				addons.find(({ id }) => id === addonProbabilities[0]?.[0])?.name,
			)}**!`,

			fetchReply: true,
		});

		if (!(message instanceof Message)) throw new TypeError("message is not a Message");

		message
			.createMessageComponentCollector({
				componentType: "BUTTON",
				filter: (buttonInteraction) => buttonInteraction.user.id === interaction.user.id,
				max: 1,
				time: 30_000,
			})
			.on("collect", async (buttonInteraction) => {
				if (CURRENTLY_PLAYING.has(interaction.user.id)) {
					return interaction.reply({
						content: `${interaction.user.toString()}, you already started a new game!`,
						ephemeral: true,
					});
				}

				const nextMessage = await reply(
					buttonInteraction,
					askedQuestions,
					addonProbabilities.slice(1),
					askedCount + 1,
				);

				if (nextMessage) CURRENTLY_PLAYING.set(interaction.user.id, nextMessage);
			})
			.on("end", async () => {
				CURRENTLY_PLAYING.delete(interaction.user.id);
				await interaction.editReply({
					components: message.components.map((rows) =>
						rows.type === "ACTION_ROW"
							? rows.setComponents(rows.components.map((component) => component))
							: rows,
					),

					content: message.content,
				});
			});

		return;
	}

	if (askedCount > 9 && !addonProbabilities[0]?.[1]) {
		await interaction.reply({
			content: `${interaction.user.toString()}, I can't give any guesses you if you don't answer my questions!`,
		});

		return;
	}

	if (!questions?.[0]) {
		await interaction.reply({
			content: `${interaction.user.toString()}, you beat me! How *did* you do that?`,
		});

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
				new MessageButton()
					.setLabel("End")
					.setStyle("SECONDARY")
					.setCustomId(generateHash("end")),
			),
		],

		content: `${interaction.user.toString()}, ${questions[0]}`,
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
					? -3
					: 0;

				const newProbabilities = answerQuestion(
					questions[0] || "",
					probabilityShift,
					addonProbabilities,
					askedQuestions,
				);

				const nextMessage = await reply(
					buttonInteraction,
					askedQuestions,
					newProbabilities,
					askedCount + 1,
				);

				if (nextMessage) CURRENTLY_PLAYING.set(interaction.user.id, nextMessage);
				else CURRENTLY_PLAYING.delete(interaction.user.id);
			}
		})
		.on("end", async (collected) => {
			const buttonPromises = [];

			if (collected.size === 0) {
				CURRENTLY_PLAYING.delete(interaction.user.id);
				buttonPromises.push(
					interaction.followUp(
						`${interaction.user.toString()}, you didn’t answer my question! I’m going to end the game.`,
					),
				);
			}

			await Promise.all([
				...buttonPromises,
				interaction.editReply({
					components: message.components.map((rows) =>
						rows.type === "ACTION_ROW"
							? rows.setComponents(
									rows.components.map((component) =>
										component.type === "BUTTON"
											? component
													.setDisabled(true)
													.setStyle(
														component.customId ===
															collected.first()?.customId
															? "SUCCESS"
															: "SECONDARY",
													)
											: component,
									),
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
	data: new SlashCommandBuilder().setDescription("You think of an addon and I guess!"),

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
		else CURRENTLY_PLAYING.delete(interaction.user.id);
	},
};

export default info;
