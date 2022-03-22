import { Util } from "discord.js";

import addons from "./addons.js";
import manifest from "./manifest.js";

/**
 * Trims the patch version off of a Semver.
 *
 * @param {string} full - The full version.
 *
 * @returns {string} - The patchless version.
 */
function trimPatchVersion(full) {
	return /^(?<main>\d+\.\d+)\.\d+/.exec(full)?.groups?.main || "";
}

const version = trimPatchVersion(manifest.version);

const QUESTIONS = {
	categories: {
		easterEgg: {
			question: "is your addon a easter egg addon (shown after typing the Konami code)?",
			statement: "This addon is an easter egg addon!",
		},

		editor: {
			code: {
				question:
					"is your addon listed under **Scratch Editor Features** -> **Code Editor**?",

				statement:
					"You addon is listed under **Scratch Editor Features** -> **Code Editor**!",
			},

			costumes: {
				question:
					"is your addon listed under **Scratch Editor Features** -> **Costume Editor**?",

				statement:
					"This addon is listed under **Scratch Editor Features** -> **Costume Editor**!",
			},

			other: {
				question: "is your addon listed under **Scratch Editor Features** -> **Others**?",
				statement: "This addon is listed under **Scratch Editor Features** -> **Others**!",
			},

			player: {
				question:
					"is your addon listed under **Scratch Editor Features** -> **Project Player**?",

				statement:
					"This addon is listed under **Scratch Editor Features** -> **Project Player**!",
			},

			root: {
				question: "is your addon listed under **Scratch Editor Features**?",
				statement: "This addon is listed under **Scratch Editor Features**!",
			},
		},

		popup: {
			question: "is your addon listed under **Extension Popup Features**?",
			statement: "This addon is listed under **Extension Popup Features**!",
		},

		themes: {
			question: "is your addon listed under **Themes**?",
			statement: "This addon is listed under **Themes**!",
		},

		website: {
			forums: {
				question: "is your addon listed under **Scratch Website Features** -> **Forums**?",
				statement: "This addon is listed under **Scratch Website Features** -> **Forums**!",
			},

			other: {
				question: "is your addon listed under **Scratch Website Features** -> **Others**?",
				statement: "This addon is listed under **Scratch Website Features** -> **Others**!",
			},

			profiles: {
				question:
					"is your addon listed under **Scratch Website Features** -> **Profiles**?",

				statement:
					"This addon is listed under **Scratch Website Features** -> **Profiles**!",
			},

			projects: {
				question:
					"is your addon listed under **Scratch Website Features** -> **Project Pages**?",

				statement:
					"This addon is listed under **Scratch Website Features** -> **Project Pages**!",
			},

			root: {
				question: "is your addon listed under **Scratch Website Features**?",
				statement: "This addon is listed under **Scratch Website Features**!",
			},
		},
	},

	groups: {
		beta: {
			question: "is your addon found under **Beta** when disabled?",
			statement: "This addon is found under **Beta** when disabled!",
		},

		featured: {
			question: "is your addon found under **Featured** when disabled?",
			statement: "This addon is found under **Featured** when disabled!",
		},

		forums: {
			question: "is your addon found under **Forums** when disabled?",
			statement: "This addon is found under **Forums** when disabled",
		},

		others: {
			question: "is your addon found under **Others** when disabled?",
			statement: "This addon is found under **Others** when disabled",
		},
	},

	history: {
		new: {
			question: `was your addon added in the latest version (**[${Util.escapeMarkdown(
				version,
			)}](https://github.com/ScratchAddons/ScratchAddons/releases/tag/v${encodeURI(
				version,
			)}.0)**)?`,

			statement: "This addon was added in the latest version!",
		},

		updated: {
			question: `was your addon updated (not including completely new addons) in the latest version (**[${Util.escapeMarkdown(
				version,
			)}](https://github.com/ScratchAddons/ScratchAddons/releases/tag/v${encodeURI(
				version,
			)}.0)**)?`,

			statement: "This addon was updated in the latest version!",
		},
	},

	settings: {
		credits: {
			question: "does your addon have credits listed on the settings page?",
			statement: "This addon has credits listed on the settings page!",
		},

		enabledDefault: {
			question: "is your addon enabled by default?",
			statement: "This addon is enabled by default!",
		},

		info: {
			question: "does your addon have any warnings and/or notices on the settings page?",
			statement: "This addon has warnings and/or notices on the settings page!",
		},

		presets: {
			question: "does your addon have any presets for its settings?",
			statement: "This addon has presets for its settings!",
		},

		preview: {
			question: "does your addon have an interactive preview for its settings?",
			statement: "This addon has an interactive preview for its settings!",
		},

		settings: {
			question: "does your addon have any settings?",
			statement: "This addon has settings!",
		},
	},

	tags: {
		beta: {
			question: "does your addon have the **Beta** tag?",
			statement: "This addon has the **Beta** tag!",
		},

		dangerous: {
			question: "does your addon have the **Dangerous** tag?",
			statement: "This addon has the **Dangerous** tag!",
		},

		forums: {
			question: "does your addon have the **Forums** tag?",
			statement: "This addon has the **Forums** tag!",
		},

		recommended: {
			question: "does your addon have the **Recommended** tag?",
			statement: "This addon has the **Recommended** tag!",
		},
	},
};

const forceEasterEggs = new Set(["cat-blocks"]);

const questionsByAddon = addons.map((addon) => {
	/**
	 * @type {{
	 * 	question: string;
	 * 	statement: string;
	 * 	dependencies?: { [key: string]: boolean };
	 * }[]}
	 */
	const result = [];

	result.push(
		{
			dependencies: Object.fromEntries(
				addons
					.map(({ name }) => [
						`does your addon’s name **start** with **${Util.escapeMarkdown(
							name.at(0)?.toUpperCase() || "",
						)}**?`,
						false,
					])
					.filter(
						([question]) =>
							question !==
							`does your addon’s name **start** with **${Util.escapeMarkdown(
								addon.name.at(0)?.toUpperCase() || "",
							)}**?`,
					),
			),

			question: `does your addon’s name **start** with **${Util.escapeMarkdown(
				addon.name.at(0)?.toUpperCase() || "",
			)}**?`,

			statement: `This addon’s name starts with **${Util.escapeMarkdown(
				addon.name.at(0)?.toUpperCase() || "",
			)}**!`,
		},
		{
			dependencies: Object.fromEntries(
				addons
					.map(({ name }) => [
						`does your addon’s name **end** with **${Util.escapeMarkdown(
							name.at(-1)?.toUpperCase() || "",
						)}**?`,
						false,
					])
					.filter(
						([question]) =>
							question !==
							`does your addon’s name **end** with **${Util.escapeMarkdown(
								addon.name.at(-1)?.toUpperCase() || "",
							)}**?`,
					),
			),

			question: `does your addon’s name **end** with **${Util.escapeMarkdown(
				addon.name.at(-1)?.toUpperCase() || "",
			)}**?`,

			statement: `This addon’s name ends with **${Util.escapeMarkdown(
				addon.name.at(-1)?.toUpperCase() || "",
			)}**!`,
		},
	);

	if (addon.enabledByDefault) {
		result.push({
			question: QUESTIONS.settings.enabledDefault.question,
			statement: QUESTIONS.settings.enabledDefault.statement,
		});
	}

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
						[QUESTIONS.categories.editor.root.question]: false,
						[QUESTIONS.categories.website.root.question]: false,
						[QUESTIONS.categories.popup.question]: false,

						[QUESTIONS.categories.easterEgg.question]: forceEasterEggs.has(addon.id)
							? undefined
							: false,
					},

					question: QUESTIONS.categories.themes.question,
					statement: QUESTIONS.categories.themes.statement,
				},
				{
					dependencies: {
						[QUESTIONS.categories.themes.question]: true,

						[`is your addon listed under **Themes** -> **${
							addon.tags.includes("editor") ? "Website" : "Editor"
						} Themes**?`]: false,
					},

					question: `is your addon listed under **Themes** -> **${
						addon.tags.includes("editor") ? "Editor" : "Website"
					} Themes**?`,

					statement: `This addon is listed under **Themes** -> **${
						addon.tags.includes("editor") ? "Editor" : "Website"
					} Themes**!`,
				},
			);

			break;
		}
		case "editor": {
			result.push({
				dependencies: {
					[QUESTIONS.categories.themes.question]: false,
					[QUESTIONS.categories.website.root.question]: false,
					[QUESTIONS.categories.popup.question]: false,

					[QUESTIONS.categories.easterEgg.question]: forceEasterEggs.has(addon.id)
						? undefined
						: false,
				},

				question: QUESTIONS.categories.editor.root.question,
				statement: QUESTIONS.categories.editor.root.statement,
			});

			if (addon.tags.includes("codeEditor")) {
				result.push({
					dependencies: {
						[QUESTIONS.categories.editor.root.question]: true,
						[QUESTIONS.categories.editor.other.question]: false,
						[QUESTIONS.categories.editor.costumes.question]: false,
						[QUESTIONS.categories.editor.player.question]: false,
					},

					question: QUESTIONS.categories.editor.code.question,
					statement: QUESTIONS.categories.editor.code.statement,
				});
			} else if (addon.tags.includes("costumeEditor")) {
				result.push({
					dependencies: {
						[QUESTIONS.categories.editor.root.question]: true,
						[QUESTIONS.categories.editor.code.question]: false,
						[QUESTIONS.categories.editor.other.question]: false,
						[QUESTIONS.categories.editor.player.question]: false,
					},

					question: QUESTIONS.categories.editor.costumes.question,
					statement: QUESTIONS.categories.editor.costumes.statement,
				});
			} else if (addon.tags.includes("projectPlayer")) {
				result.push({
					dependencies: {
						[QUESTIONS.categories.editor.root.question]: true,
						[QUESTIONS.categories.editor.code.question]: false,
						[QUESTIONS.categories.editor.costumes.question]: false,
						[QUESTIONS.categories.editor.other.question]: false,
					},

					question: QUESTIONS.categories.editor.player.question,
					statement: QUESTIONS.categories.editor.player.statement,
				});
			} else {
				result.push({
					dependencies: {
						[QUESTIONS.categories.editor.root.question]: true,
						[QUESTIONS.categories.editor.code.question]: false,
						[QUESTIONS.categories.editor.costumes.question]: false,
						[QUESTIONS.categories.editor.player.question]: false,
					},

					question: QUESTIONS.categories.editor.other.question,
					statement: QUESTIONS.categories.editor.other.statement,
				});
			}

			break;
		}
		case "community": {
			if (addon.tags.includes("profiles")) {
				result.push({
					dependencies: {
						[QUESTIONS.categories.website.root.question]: true,
						[QUESTIONS.categories.website.other.question]: false,
						[QUESTIONS.categories.website.projects.question]: false,
						[QUESTIONS.categories.website.forums.question]: false,
					},

					question: QUESTIONS.categories.website.profiles.question,
					statement: QUESTIONS.categories.website.profiles.statement,
				});
			} else if (addon.tags.includes("projectPage")) {
				result.push({
					dependencies: {
						[QUESTIONS.categories.website.root.question]: true,
						[QUESTIONS.categories.website.profiles.question]: false,
						[QUESTIONS.categories.website.other.question]: false,
						[QUESTIONS.categories.website.forums.question]: false,
					},

					question: QUESTIONS.categories.website.projects.question,
					statement: QUESTIONS.categories.website.projects.statement,
				});
			} else if (addon.tags.includes("forums")) {
				result.push({
					dependencies: {
						[QUESTIONS.categories.website.root.question]: true,
						[QUESTIONS.categories.website.profiles.question]: false,
						[QUESTIONS.categories.website.projects.question]: false,
						[QUESTIONS.categories.website.other.question]: false,
					},

					question: QUESTIONS.categories.website.forums.question,
					statement: QUESTIONS.categories.website.forums.statement,
				});
			} else {
				result.push({
					dependencies: {
						[QUESTIONS.categories.website.root.question]: true,
						[QUESTIONS.categories.website.profiles.question]: false,
						[QUESTIONS.categories.website.projects.question]: false,
						[QUESTIONS.categories.website.forums.question]: false,
					},

					question: QUESTIONS.categories.website.other.question,
					statement: QUESTIONS.categories.website.other.statement,
				});
			}

			result.push({
				dependencies: {
					[QUESTIONS.categories.themes.question]: false,
					[QUESTIONS.categories.editor.root.question]: false,
					[QUESTIONS.categories.popup.question]: false,
				},

				question: QUESTIONS.categories.website.root.question,
				statement: QUESTIONS.categories.website.root.statement,
			});

			break;
		}
		case "popup": {
			result.push({
				dependencies: {
					[QUESTIONS.categories.themes.question]: false,
					[QUESTIONS.categories.editor.root.question]: false,
					[QUESTIONS.categories.website.root.question]: false,
				},

				question: QUESTIONS.categories.popup.question,
				statement: QUESTIONS.categories.popup.statement,
			});

			break;
		}
		case "easterEgg": {
			result.push({
				dependencies: {
					[QUESTIONS.categories.themes.question]: false,
					[QUESTIONS.categories.popup.question]: false,
					[QUESTIONS.categories.editor.root.question]: false,
					[QUESTIONS.categories.website.root.question]: false,
				},

				question: QUESTIONS.categories.easterEgg.question,
				statement: QUESTIONS.categories.easterEgg.statement,
			});

			break;
		}
	}

	if (forceEasterEggs.has(addon.id)) {
		result.push({
			question: QUESTIONS.categories.easterEgg.question,
			statement: QUESTIONS.categories.easterEgg.statement,
		});
	}

	if (addon.tags.includes("recommended")) {
		result.push({
			dependencies: {
				[QUESTIONS.groups.featured.question]: false,
				[QUESTIONS.groups.beta.question]: false,
				[QUESTIONS.groups.others.question]: false,
			},

			question: QUESTIONS.tags.recommended.question,
			statement: QUESTIONS.tags.recommended.statement,
		});
	} else if (addon.tags.includes("featured")) {
		result.push({
			dependencies: {
				[QUESTIONS.groups.beta.question]: false,
				[QUESTIONS.groups.forums.question]: false,
				[QUESTIONS.groups.others.question]: false,
				[QUESTIONS.tags.recommended.question]: false,
			},

			question: QUESTIONS.groups.featured.question,
			statement: QUESTIONS.groups.featured.statement,
		});
	} else if (addon.tags.includes("beta") || addon.tags.includes("danger")) {
		result.push({
			dependencies: {
				[QUESTIONS.groups.featured.question]: false,
				[QUESTIONS.groups.forums.question]: false,
				[QUESTIONS.groups.others.question]: false,
			},

			question: QUESTIONS.groups.beta.question,
			statement: QUESTIONS.groups.beta.statement,
		});
	} else if (addon.tags.includes("forums")) {
		result.push({
			dependencies: {
				[QUESTIONS.groups.featured.question]: false,
				[QUESTIONS.groups.beta.question]: false,
				[QUESTIONS.tags.forums.question]: true,
				[QUESTIONS.groups.others.question]: false,
			},

			question: QUESTIONS.groups.forums.question,
			statement: QUESTIONS.groups.forums.statement,
		});
	} else {
		result.push({
			dependencies: {
				[QUESTIONS.groups.featured.question]: false,
				[QUESTIONS.groups.beta.question]: false,
				[QUESTIONS.groups.forums.question]: false,
				[QUESTIONS.tags.forums.question]: false,
			},

			question: QUESTIONS.groups.others.question,
			statement: QUESTIONS.groups.others.statement,
		});
	}

	if (addon.tags.includes("danger")) {
		result.push({
			dependencies: { [QUESTIONS.groups.beta.question]: true },
			question: QUESTIONS.tags.dangerous.question,
			statement: QUESTIONS.tags.dangerous.statement,
		});
	}

	if (addon.tags.includes("forums")) {
		result.push({
			dependencies: { [QUESTIONS.groups.others.question]: false },
			question: QUESTIONS.tags.forums.question,
			statement: QUESTIONS.tags.forums.statement,
		});
	}

	if (addon.tags.includes("beta")) {
		result.push({
			dependencies: { [QUESTIONS.groups.beta.question]: true },
			question: QUESTIONS.tags.beta.question,
			statement: QUESTIONS.tags.beta.statement,
		});
	}

	if (addon.info) {
		result.push({
			question: QUESTIONS.settings.info.question,
			statement: QUESTIONS.settings.info.statement,
		});
	}

	if (addon.credits) {
		result.push(
			{
				question: QUESTIONS.settings.credits.question,
				statement: QUESTIONS.settings.credits.statement,
			},
			...addon.credits.map(({ name }) => ({
				dependencies: { [QUESTIONS.settings.credits.question]: true },
				question: `did **${Util.escapeMarkdown(name)}** contribute to your addon?`,
				statement: `**${Util.escapeMarkdown(name)}** contributed to this addon!`,
			})),
		);
	}

	if (addon.settings) {
		result.push({
			question: QUESTIONS.settings.settings.question,
			statement: QUESTIONS.settings.settings.statement,
		});
	}

	if (addon.presets) {
		result.push({
			dependencies: { [QUESTIONS.settings.settings.question]: true },
			question: QUESTIONS.settings.presets.question,
			statement: QUESTIONS.settings.presets.statement,
		});
	}

	if (addon.addonPreview) {
		result.push({
			dependencies: { [QUESTIONS.settings.settings.question]: true },
			question: QUESTIONS.settings.preview.question,
			statement: QUESTIONS.settings.preview.statement,
		});
	}

	if (addon.versionAdded && version === trimPatchVersion(addon.versionAdded)) {
		result.push(
			{
				question: QUESTIONS.history.new.question,
				statement: QUESTIONS.history.new.statement,
			},
			{
				dependencies: {
					[QUESTIONS.history.new.question]: true,

					[`is your addon found under **${
						addon.tags.includes("recommended") || addon.tags.includes("featured")
							? "Other"
							: "Featured"
					} new addons and updates** as of version **[${Util.escapeMarkdown(
						version,
					)}](https://github.com/ScratchAddons/ScratchAddons/releases/tag/v${encodeURI(
						version,
					)}.0)**?`]: false,
				},

				question: `is your addon found under **${
					addon.tags.includes("recommended") || addon.tags.includes("featured")
						? "Featured"
						: "Other"
				} new addons and updates** as of version **[${Util.escapeMarkdown(
					version,
				)}](https://github.com/ScratchAddons/ScratchAddons/releases/tag/v${encodeURI(
					version,
				)}.0)**?`,

				statement: `This addon is currently found under **${
					addon.tags.includes("recommended") || addon.tags.includes("featured")
						? "Featured"
						: "Other"
				} new addons and updates**!`,
			},
		);
	}

	if (addon.latestUpdate && version === trimPatchVersion(addon.latestUpdate.version)) {
		result.push(
			{
				question: QUESTIONS.history.updated.question,
				statement: QUESTIONS.history.updated.statement,
			},

			{
				dependencies: {
					[QUESTIONS.history.updated.question]: true,

					[`does your addon have the **${
						manifest.latestUpdate.newSettings?.length ? "New features" : "New settings"
					}** tag?`]: false,
				},

				question: `does your addon have the **${
					manifest.latestUpdate.newSettings?.length ? "New settings" : "New features"
				}** tag?`,

				statement: `This addon has the **${
					manifest.latestUpdate.newSettings?.length ? "New settings" : "New features"
				}** tag!`,
			},
			{
				dependencies: {
					[QUESTIONS.history.updated.question]: true,

					[`is your addon found under **${
						manifest.latestUpdate.isMajor ? "Other" : "Featured"
					} new addons and updates** as of **[${Util.escapeMarkdown(
						version,
					)}](https://github.com/ScratchAddons/ScratchAddons/releases/tag/v${encodeURI(
						version,
					)}.0)**?`]: false,
				},

				question: `is your addon found under **${
					manifest.latestUpdate.isMajor ? "Featured" : "Other"
				} new addons and updates** as of **[${Util.escapeMarkdown(
					version,
				)}](https://github.com/ScratchAddons/ScratchAddons/releases/tag/v${encodeURI(
					version,
				)}.0)**?`,

				statement: `This addon is currently found under **${
					manifest.latestUpdate.isMajor ? "Featured" : "Other"
				} new addons and updates**!`,
			},
		);
	}

	return /** @type {[string, typeof result]} */ ([addon.id, result]);
});

export default questionsByAddon;
