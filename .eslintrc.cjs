/** @file ESLint Configuration file. */
"use strict";

require("@rushstack/eslint-patch/modern-module-resolution");

/** @type {import("eslint").Linter.Config} */
const config = {
	extends: ["@redguy12", "@redguy12/eslint-config/node"],

	overrides: [
		{
			extends: "@redguy12/eslint-config/esm",
			// ESM files
			files: "**.js",
		},
		{
			files: "!**.md/*",
			parserOptions: { project: require("path").resolve(__dirname, "./jsconfig.json") },
		},
	],

	root: true,
};

module.exports = config;
