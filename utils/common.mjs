import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * File extensions by kind of outlined content. The split tool does not decide where files go: the `id` of a
 * <script>/<style> element (or the name of an HTML partial) *is* the file path relative to the split directory,
 * e.g. `<script id="src/import/tavern.js">` is written to `split/index/src/import/tavern.js`.
 * If the name does not end in one of the extensions for its kind, the first one is appended
 * (so plain ids like `<script id="main">` keep producing `main.js`, as before).
 */
export const EXTENSIONS = Object.freeze({
	script: Object.freeze(['.js', '.mjs']),
	style: Object.freeze(['.css']),
	html: Object.freeze(['.html', '.htm']),
});

// A path segment: starts with a letter, digit or underscore; may contain dots and dashes (but no '..').
const reSegment = /^[A-Za-z0-9_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_-])?$/;

/**
 * Checks whether a name can safely be used as a relative path (segments separated by '/').
 *
 * @param {string} name
 */
export function isValidSplitName(name) {
	if (!name) return false;
	return name.split('/').every(segment => reSegment.test(segment) && !segment.includes('..'));
}

/**
 * Maps a split name to a file path relative to the split directory: the name itself, plus the default
 * extension for its kind if it does not already have a matching one.
 *
 * @param {keyof typeof EXTENSIONS} kind
 * @param {string} name
 */
export function splitNameToPath(kind, name) {
	const extensions = EXTENSIONS[kind];
	return extensions.some(ext => name.endsWith(ext)) ? name : name + extensions[0];
}

/**
 * Returns the portable identity of a path in the split directory. Split output may be moved between case-sensitive
 * and case-insensitive file systems, so names that differ only by ASCII letter case must never identify different
 * files. Split names are restricted to ASCII by `isValidSplitName`, which makes lower-casing deterministic.
 *
 * @param {string} path
 */
export const splitPathKey = path => path.toLowerCase();

// Line endings. The files in the repository use LF, but a Windows checkout (git's core.autocrlf) has CRLF.
// split and join work on LF internally. split writes the split files with the line endings of the HTML file; join
// accepts either in the split files and writes the HTML file with the line endings of the split HTML file. (A file
// that mixes both gets the most common one; browsers and JavaScript treat CRLF and LF the same.)

/**
 * @param {string} text
 * @returns {{ eol: '\n' | '\r\n'; mixed: boolean }} The most common line ending in `text`, and whether there are others.
 */
export function detectEol(text) {
	const crlf = text.match(/\r\n/g)?.length ?? 0;
	const lf = (text.match(/\n/g)?.length ?? 0) - crlf;
	return { eol: crlf > lf ? '\r\n' : '\n', mixed: crlf > 0 && lf > 0 };
}

/** @param {string} text */
export const crlfToLf = text => text.replace(/\r\n/g, '\n');

/**
 * @param {string} text Text with LF line endings.
 * @param {string} eol
 */
export const lfToEol = (text, eol) => (eol == '\n' ? text : text.replace(/\n/g, eol));

/**
 * Writes a file, creating any missing parent directories.
 *
 * @param {string} path
 * @param {string} content
 */
export async function writeFileDeep(path, content) {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, content);
}

/**
 * @typedef {(
 *   [action: 'leading', numLines: number] | [action: 'trailing', numLines: number] |
 *   [action: 'indent', skipLines: number, indent: string]
 * )} Action
 */

/**
 * Removes extra leading and trailing newlines and constant indentation from embedded content,
 * recording the actions needed to restore it to its original form.
 *
 * @param {string} content
 * @returns {{ text: string; actions: Action[] }} The outdented text (with a single trailing newline) and the actions.
 */
export function outdent(content) {
	// Split the embedded content into lines.
	let lines = content.split('\n');
	let n = lines.length;

	// Record the processing actions performed on the content.
	/** @type {Action[]} */
	const actions = [];

	// Count leading newlines.
	let l = 0;
	for (; l < n && lines[l].length == 0; ++l);

	// Count trailing newlines.
	let r = n;
	for (; r > 0 && lines[r - 1].length == 0; --r);

	// Remove leading and trailing newlines.
	if (l > 0 || r < n) {
		if (l > 0) actions.unshift(['leading', l]);
		if (r < n) actions.unshift(['trailing', n - r]);
		lines = lines.slice(l, r);
		n = lines.length;
	}

	// Detect and remove constant indentation, with special handling for the first line and leading empty lines.
	const reIndent = /^[\t ]*/;
	// Find the first non-empty line after the first line.
	for (l = 1; l < n && lines[l].length == 0; ++l);
	if (l < n) {
		// Get the indentation of the first non-empty line after the first line.
		let indent = lines[l].match(reIndent)[0];
		if (indent) {
			// Find the largest amount of indentation (if any) that applies to all non-empty lines.
			// Note: This is not robust against inconsistent indentation (like mixing spaces and tabs).
			for (l = 1; l < n; ++l) {
				const line = lines[l];
				if (line) {
					while (indent && !line.startsWith(indent)) indent = indent.slice(0, -1);
					if (!indent) break;
				}
			}
			// If we found some amount of shared indentation, record it and remove it.
			if (indent) {
				r = indent.length;
				// Check if the first line also has the same indentation.
				l = lines[0].startsWith(indent) ? 0 : 1;
				actions.unshift(['indent', l, indent]);
				for (; l < n; ++l) {
					const line = lines[l];
					if (line) lines[l] = line.slice(r);
				}
			}
		}
	} else if (n > 0) {
		// First line is the only non-empty line, so record and remove its indentation.
		let indent = lines[0].match(reIndent)[0];
		if (indent) {
			r = indent.length;
			actions.unshift(['indent', 0, indent]);
			lines[0] = lines[0].slice(r);
		}
	}

	// Count leading newlines.
	for (l = 0; l < r && lines[l].length == 0; ++l);

	// Count trailing newlines.
	for (r = n; r > 0 && lines[r - 1].length == 0; --r);

	// Remove leading and trailing newlines.
	if (l > 0 || r < n) {
		if (l > 0) actions.unshift(['leading', l]);
		if (r < n) actions.unshift(['trailing', n - r]);
		lines = lines.slice(l, r);
		n = lines.length;
	}

	// Add a single trailing newline.
	return { text: lines.join('\n') + '\n', actions };
}

/**
 * Reverses `outdent`.
 *
 * @param {string} text The outdented text, as written to disk.
 * @param {Action[]} actions
 */
export function restore(text, actions) {
	const lines = text.split('\n');

	// Remove the trailing newline, if any.
	if (lines.at(-1) == '') lines.pop();

	for (const action of actions) {
		switch (action[0]) {
			case 'leading': {
				// Restore leading newlines.
				const numLines = action[1];
				lines.unshift(...Array.from({ length: numLines }, () => ''));
				break;
			}
			case 'trailing': {
				// Restore trailing newlines.
				const numLines = action[1];
				lines.push(...Array.from({ length: numLines }, () => ''));
				break;
			}
			case 'indent': {
				// Restore indentation.
				const indent = action[2];
				const n = lines.length;
				for (let i = action[1]; i < n; ++i) {
					const line = lines[i];
					// Ignore empty lines *except* the last line (the one just before the closing tag).
					if (line || i == n - 1) lines[i] = indent + line;
				}
				break;
			}
			default:
				throw new Error(`Unknown action '${action}'!`);
		}
	}

	return lines.join('\n');
}

/**
 * Reads an outlined file (converting CRLF to LF) and restores its original form.
 *
 * @param {string} path
 * @param {Action[]} actions
 * @returns {Promise<string | undefined>} The restored content, or undefined if the file does not exist.
 */
export async function readAndRestore(path, actions) {
	let text;
	try {
		text = await readFile(path, { encoding: 'utf-8' });
	} catch {
		return undefined;
	}
	return restore(crlfToLf(text), actions);
}

// HTML partial markers. The begin/end markers live in the monolithic HTML; the include marker
// replaces a whole marked region in the split HTML.
//   <!-- split: src/settings/settings-popup.html -->  ...markup...  <!-- /split: src/settings/settings-popup.html -->
//   <!-- split-include: src/settings/settings-popup.html [["indent",0,"\t"]] -->
const NAME = '([^\\s>]+)';
export const reHtmlMarker = new RegExp(`<!-- (/?)split: ${NAME} -->`, 'g');
export const reHtmlInclude = new RegExp(`<!-- split-include: ${NAME}(?: (\\[[^\\n]*?\\]))? -->`, 'g');
// Anything that looks like a marker, used to catch typos in non-canonical markers.
export const reHtmlMarkerLike = /<!--\s*\/?\s*split(?:-include)?\s*:/g;

/**
 * Checks the `<!-- split: path -->` ... `<!-- /split: path -->` markers of an HTML document: every marker-like comment
 * must be in the canonical form, names must be valid paths, and markers must be balanced and properly nested.
 * Throws an error describing the first problem.
 *
 * @param {string} html
 */
export function checkHtmlMarkers(html) {
	// Catch markers that are not in the canonical form (they would silently be ignored otherwise).
	const reExact = new RegExp(`^${reHtmlMarker.source}$`);
	for (const m of html.matchAll(reHtmlMarkerLike)) {
		const end = html.indexOf('-->', m.index);
		if (end == -1 || !reExact.test(html.slice(m.index, end + 3))) {
			throw new Error(
				`Malformed split marker at line ${lineOf(html, m.index)}; use '<!-- split: path/to/file.html -->' and '<!-- /split: path/to/file.html -->'.`,
			);
		}
	}
	/** @type {{ name: string; offset: number }[]} */
	const stack = [];
	for (const m of html.matchAll(reHtmlMarker)) {
		const [marker, isEnd, name] = m;
		if (!isEnd) {
			if (!isValidSplitName(name)) throw new Error(`Invalid split name '${name}' at line ${lineOf(html, m.index)}!`);
			stack.push({ name, offset: m.index });
		} else {
			const open = stack.pop();
			if (!open) throw new Error(`Unexpected '${marker}' at line ${lineOf(html, m.index)}!`);
			if (open.name != name) {
				throw new Error(`'${marker}' at line ${lineOf(html, m.index)} does not match '<!-- split: ${open.name} -->'!`);
			}
		}
	}
	if (stack.length) {
		const open = stack.at(-1);
		throw new Error(`Unclosed '<!-- split: ${open.name} -->' at line ${lineOf(html, open.offset)}!`);
	}
}

export const htmlBegin = name => `<!-- split: ${name} -->`;
export const htmlEnd = name => `<!-- /split: ${name} -->`;
export const htmlInclude = (name, actions) =>
	`<!-- split-include: ${name}${actions.length ? ` ${JSON.stringify(actions)}` : ''} -->`;

// ---------- sections: splitting a <script>/<style> into feature files without changing its order
//
// In the monolithic HTML, a line `/* split: path */` (the same in scripts and styles) starts a section that runs until
// the next marker or the end of the element. Every section is appended to the file `path`; when a file gets more than
// one section, they are separated by a line `/* @split-section */`. The order file lists, per element, the file of
// every section in order (the k-th time a file is listed is its k-th section), so join can put everything back in its
// original order.

/** File (in the split directory) that records the order of the sections. */
export const ORDER_FILE = 'split-order.txt';

// Attribute marking the <script src>/<link rel="stylesheet"> elements that split adds to load the feature files.
export const LOAD_ATTR = 'data-split-load';

/** @param {string} name */
export const sectionMarker = name => `/* split: ${name} */`;
export const SECTION_SEPARATOR = '/* @split-section */';

/** Exact section marker (optionally indented); captures the indentation and the name. */
export const reSectionMarker = /^([ \t]*)\/\* split: (\S+) \*\/$/;
/** Anything that looks like a section marker (to catch typos, and markers in the old `// split:` style). */
export const reSectionMarkerLike = /^\s*(?:\/\/|\/\*)\s*split\s*:/;
/** Exact section separator (at the start of the line). */
export const reSectionSeparator = /^\/\* @split-section \*\/$/;
/** Anything that looks like a section separator. */
export const reSectionSeparatorLike = /@split-section\b/;

/**
 * @typedef {{ name: string; marker?: string; indent?: string }} OrderEntry
 *   A section: the name in its marker, and (if different from the element's indentation) the indentation of the marker
 *   line and the indentation removed from the section's lines.
 * @typedef {{ tag: 'script' | 'style'; key: string; indent: string; entries: OrderEntry[] }} OrderElement
 */

/**
 * Serializes the order file.
 *
 * @param {string} htmlFile
 * @param {OrderElement[]} elements
 */
export function serializeOrder(htmlFile, elements) {
	const out = [
		`# Section order for ${htmlFile}, written by 'npm run split' and read by 'npm run join'.`,
		`# For every split <script>/<style> element, the file of each of its sections, in their order in ${htmlFile}.`,
		`# The 1st, 2nd, 3rd... time a file is listed is its 1st, 2nd, 3rd... section (separated by '@split-section' lines),`,
		`# and that code goes back to that position. (Extensions are added if missing.)`,
		`# If you move or rename a file, change its path here too (on every line). Do not add, remove or reorder lines;`,
		`# to add a new file, put a line '/* split: path/to/file.js */' where its code belongs in one of the split files.`,
		`# {"indent": ...} is the indentation the code had in ${htmlFile}.`,
	];
	for (const { tag, key, indent, entries } of elements) {
		out.push('', `<${tag} ${key} ${JSON.stringify({ indent })}>`);
		for (const { name, marker, indent: sectionIndent } of entries) {
			/** @type {Record<string, string>} */
			const extra = {};
			if (marker !== undefined && marker != indent) extra.marker = marker;
			if (sectionIndent !== undefined && sectionIndent != indent) extra.indent = sectionIndent;
			out.push(`${name}${Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : ''}`);
		}
		out.push(`</${tag}>`);
	}
	return out.join('\n') + '\n';
}

/**
 * Parses the order file.
 *
 * @param {string} text
 * @returns {Map<string, OrderElement>} By element key; entries have `marker` and `indent` filled in.
 */
export function parseOrder(text) {
	/** @type {Map<string, OrderElement>} */
	const elements = new Map();
	/** @type {OrderElement | null} */
	let current = null;
	const json = (str, fail) => {
		let v;
		try { v = JSON.parse(str); } catch { fail(`invalid JSON '${str}'`); }
		if (typeof v != 'object' || !v || Object.values(v).some(x => typeof x != 'string' || !/^[ \t]*$/.test(x))) fail(`invalid options '${str}'`);
		return v;
	};
	text.split('\n').forEach((raw, i) => {
		const line = raw.trim();
		const fail = msg => { throw new Error(`${ORDER_FILE} line ${i + 1}: ${msg}`); };
		if (!line || line.startsWith('#')) return;
		let m;
		if ((m = /^<(script|style) (\S+)(?: (\{.*\}))?>$/.exec(line))) {
			if (current) fail(`'<${m[1]} ${m[2]}>' inside another element`);
			if (elements.has(m[2])) fail(`duplicate element '${m[2]}'`);
			const indent = m[3] ? (json(m[3], fail).indent ?? '') : '';
			current = { tag: /** @type {'script' | 'style'} */ (m[1]), key: m[2], indent, entries: [] };
			elements.set(m[2], current);
		} else if ((m = /^<\/(script|style)>$/.exec(line))) {
			if (!current || m[1] != current.tag) fail(`unexpected '${line}'`);
			current = null;
		} else if ((m = /^(\S+)(?: (\{.*\}))?$/.exec(line))) {
			if (!current) fail('section outside of an element');
			if (!isValidSplitName(m[1])) fail(`invalid name '${m[1]}'`);
			const extra = m[2] ? json(m[2], fail) : {};
			current.entries.push({ name: m[1], marker: extra.marker ?? current.indent, indent: extra.indent ?? current.indent });
		} else {
			fail(`cannot parse '${line}'`);
		}
	});
	if (current) throw new Error(`${ORDER_FILE}: unclosed element`);
	return elements;
}

/**
 * Removes the indentation shared by all lines of a section that contain more than whitespace. Whitespace-only lines are
 * left alone, which makes `indentSection` its exact inverse.
 *
 * @param {string[]} lines
 * @returns {{ lines: string[]; indent: string }}
 */
export function outdentSection(lines) {
	/** @type {string | null} */
	let indent = null;
	for (const line of lines) {
		if (!line.trim()) continue;
		const own = /^[ \t]*/.exec(line)[0];
		if (indent === null) indent = own;
		while (!own.startsWith(indent)) indent = indent.slice(0, -1);
		if (!indent) break;
	}
	indent ??= '';
	return { lines: indent ? lines.map(line => (line.trim() ? line.slice(indent.length) : line)) : lines, indent };
}

/**
 * @param {string[]} lines
 * @param {string} indent
 */
export function indentSection(lines, indent) {
	return indent ? lines.map(line => (line.trim() ? indent + line : line)) : lines;
}

/**
 * Returns the 1-based line number of an offset into a string, for error messages.
 *
 * @param {string} str
 * @param {number} offset
 */
export function lineOf(str, offset) {
	let line = 1;
	for (let i = str.indexOf('\n'); i != -1 && i < offset; i = str.indexOf('\n', i + 1)) ++line;
	return line;
}
