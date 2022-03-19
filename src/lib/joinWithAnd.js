/**
 * Grammatically correctly join an array.
 *
 * @file Join An array with commas and the word "and".
 *
 * @template T
 *
 * @param {T[]} array - The array to join.
 * @param {(item: T) => string} [callback] - A function to call on each item. Defaults to just
 *   converting it to a string.
 *
 * @returns {string} - Joined array.
 */

// eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- If this doesn't work, then they should define their own callback.
export default function joinWithAnd(array, callback = (item) => `${item}`) {
	const last = array.pop();

	if (typeof last === "undefined") return "";

	if (array.length === 0) return callback(last);

	return array[0]
		? `${
				array.length === 1
					? `${callback(array[0])} `
					: array.map((item) => `${callback(item)}, `).join("")
		  }and ${callback(last)}`
		: "";
}
