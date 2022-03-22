import fetch from "node-fetch";

import CONSTANTS from "./CONSTANTS.js";

export default await fetch(`${CONSTANTS.repository}/manifest.json`).then(
	async (response) => await /** @type {Promise<chrome.runtime.ManifestV2>} */ (response.json()),
);
