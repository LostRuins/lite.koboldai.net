import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

import {
	LOAD_ATTR,
	ORDER_FILE,
	checkHtmlMarkers,
	htmlInclude,
	isValidSplitName,
	lineOf,
	outdent,
	reHtmlMarker,
	reSectionMarker,
	reSectionMarkerLike,
	reSectionSeparatorLike,
	outdentSection,
	SECTION_SEPARATOR,
	sectionMarker,
	serializeOrder,
	splitNameToPath,
	splitPathKey,
	writeFileDeep,
	crlfToLf,
	detectEol,
	lfToEol,
} from './common.mjs';
import { makeAttribute, makeString, parse, serialize } from './parser.mjs';

/** @import * as t from './parser.mjs' */

// Command line: [file.html] [--no-html] [--no-sections]
const args = process.argv.slice(2);
const flags = new Set(args.filter(arg => arg.startsWith('--')));
for (const flag of flags) if (flag != '--no-html' && flag != '--no-sections') throw new Error(`Unknown option '${flag}'!`);

// Input/output html file name.
const htmlFile = args.find(arg => !arg.startsWith('--')) ?? 'index.html';

// Whether to outline marked HTML regions into partials (disable to keep the split HTML runnable in a browser).
const outlineHtml = !flags.has('--no-html');

// Whether to split scripts/styles with `/* split: path */` section markers into feature files (disable to keep every
// element in one file, in its original order, so the split HTML stays runnable in a browser).
const useSections = !flags.has('--no-sections');

// Split files directory.
const splitDir = `split/${htmlFile.slice(0, -5)}`;

// Read the source file from the input directory.
const rawSrc = await readFile(htmlFile, { encoding: 'utf-8' });

// Work on LF line endings; every file is written with the line endings of the HTML file (see common.mjs).
const { eol, mixed } = detectEol(rawSrc);
if (mixed) {
	console.warn(
		`Note: ${htmlFile} mixes CRLF and LF line endings; the split files (and ${htmlFile} after joining) use ` +
			`${eol == '\r\n' ? 'CRLF' : 'LF'} throughout.`,
	);
}
const src = crlfToLf(rawSrc);

// Parse the file into a custom parse tree.
const document = parse(src);

// Get the outer <html> tag, if any, or fall back to the document root.
const htmlOrDoc =
	document.children.filter(node => node.type == 'element').find(node => node.tagName == 'html') ?? document;

// Get the <head> tag, if any.
const head = htmlOrDoc.children.filter(node => node.type == 'element').find(node => node.tagName == 'head');

// Get the <body> tag, if any.
const body = htmlOrDoc.children.filter(node => node.type == 'element').find(node => node.tagName == 'body');

// Every file written so far (portable path key -> original path), to catch duplicate ids/names. Keys are
// case-insensitive even on a case-sensitive host so split output remains safe when moved to Windows or macOS.
/** @type {Map<string, string>} */
const writtenFiles = new Map();

/**
 * @param {string} fileName Path relative to the split directory.
 * @param {string} content
 */
async function writeSplitFile(fileName, content) {
	const key = splitPathKey(fileName);
	const previous = writtenFiles.get(key);
	if (previous !== undefined) {
		const names =
			previous == fileName ? `'${fileName}'` : `'${previous}' and '${fileName}' (paths differ only by letter case)`;
		throw new Error(`Duplicate split file ${names} (check for duplicate ids/names)!`);
	}
	if (key == splitPathKey(htmlFile)) throw new Error(`Split file '${fileName}' would overwrite the split HTML file!`);
	writtenFiles.set(key, fileName);
	await writeFileDeep(`${splitDir}/${fileName}`, lfToEol(content, eol));
}

/**
 * @param {t.Element} node
 * @param {string} fileName
 */
async function analyzeAndWriteEmbedded(node, fileName) {
	// Remove extra leading and trailing newlines and indentation.
	const { text, actions } = outdent(node.innerHTML);

	// Write the file.
	await writeSplitFile(fileName, text);

	// Return the actions that were performed.
	return actions;
}

/**
 * Determines the file name for an outlined script or stylesheet from its id. The id is the path relative to the
 * split directory, e.g. `<script id="src/import/tavern.js">` is written to `src/import/tavern.js`; an id without
 * a matching extension gets one appended (`<script id="main">` -> `main.js`). Elements without a usable id get
 * a generated name.
 *
 * @param {'script' | 'style'} kind
 * @param {string | undefined} elemId
 * @param {string} fallbackId
 */
function getFileName(kind, elemId, fallbackId) {
	if (elemId && !isValidSplitName(elemId)) {
		console.warn(`Warning: id '${elemId}' cannot be used as a file path, using '${fallbackId}' instead.`);
		elemId = undefined;
	}
	return splitNameToPath(kind, elemId || fallbackId);
}

// Sections collected so far: file path -> its sections (lines without indentation); written after all elements.
/** @type {Map<string, { kind: 'script' | 'style'; sections: string[][] }>} */
const sectionFiles = new Map();
/** @type {(import('./common.mjs').OrderElement & { node: t.Element; parent: t.Element })[]} */
const orderElements = [];
/** @type {Set<string>} */
const elementKeys = new Set();
let sectionCounter = 0;

/**
 * Returns whether the content of a script/style element contains section markers.
 *
 * @param {'script' | 'style'} kind
 * @param {string} content
 */
function hasSectionMarkers(kind, content) {
	const reLike = reSectionMarkerLike;
	return content.split('\n').some(line => reLike.test(line));
}

/**
 * Splits a script/style element into sections (see common.mjs) and empties it, recording the order.
 *
 * @param {t.Element} node
 * @param {t.Element} parent
 * @param {'script' | 'style'} kind
 * @param {string} key Unique key of the element in the order file.
 */
function outlineSections(node, parent, kind, key) {
	const where = `<${kind} ${key}>`;
	if (elementKeys.has(key)) throw new Error(`Duplicate element key '${key}' (check for duplicate ids)!`);
	elementKeys.add(key);

	const lines = node.innerHTML.split('\n');
	const reMarker = reSectionMarker;
	const reLike = reSectionMarkerLike;

	// Whitespace-only lines before the first marker and after the last code line stay with the element.
	let first = lines.findIndex(line => reLike.test(line));
	let end = lines.length;
	while (end > first + 1 && !lines[end - 1].trim()) end--;
	const head = lines.slice(0, first);
	const tail = lines.slice(end);
	const headCode = head.findIndex(line => line.trim());
	if (headCode != -1) throw new Error(`${where} line ${headCode + 1}: code before the first section marker!`);

	/** @type {{ name: string; marker: string; lines: string[] }[]} */
	const sections = [];
	for (let i = first; i < end; i++) {
		const line = lines[i];
		if (reSectionSeparatorLike.test(line)) throw new Error(`${where} line ${i + 1}: '@split-section' is reserved for split files!`);
		const m = reMarker.exec(line);
		if (m) {
			const [, marker, name] = m;
			if (!isValidSplitName(name)) throw new Error(`${where} line ${i + 1}: invalid split name '${name}'!`);
			sectionCounter++;
			sections.push({ name, marker, lines: [] });
		} else if (reLike.test(line)) {
			throw new Error(
				`${where} line ${i + 1}: malformed section marker '${line.trim()}'` +
					` (use '${sectionMarker(`path/to/file.${kind == 'script' ? 'js' : 'css'}`)}')!`,
			);
		} else {
			sections.at(-1).lines.push(line);
		}
	}

	/** @type {import('./common.mjs').OrderEntry[]} */
	const entries = [];
	for (const { name, marker, lines: sectionLines } of sections) {
		const path = splitNameToPath(kind, name);
		if (!sectionFiles.has(path)) sectionFiles.set(path, { kind, sections: [] });
		const out = outdentSection(sectionLines);
		sectionFiles.get(path).sections.push(out.lines);
		entries.push({ name, marker, indent: out.indent });
	}
	// The element's usual indentation (the most common one), so the order file only has to mention the exceptions.
	/** @type {Map<string, number>} */
	const counts = new Map();
	for (const { marker, indent } of entries) for (const x of [marker, indent]) counts.set(x, (counts.get(x) ?? 0) + 1);
	const indent = [...counts].sort((a, b) => b[1] - a[1])[0][0];
	orderElements.push({ tag: kind, key, indent, entries, node, parent });

	// Leave an empty element that join fills again.
	node.children.length = 0;
	node.addAttr(makeAttribute('data-split-sections', key));
	node.addAttr(makeAttribute('data-split-frame', JSON.stringify([head, tail])));
}

/**
 * @param {string} prefix
 * @param {t.Element | undefined} parent
 * @param {{ until?: t.Element; after?: t.Element }} [options]
 */
async function outlineScriptAndStyleElems(prefix, parent, options = {}) {
	if (!parent) return;

	const { until, after } = options;

	let scriptCounter = 0;
	let styleCounter = 0;

	let afterSeen = !after;
	for (const node of parent.children) {
		// Stop if we see the 'until' node.
		if (node === until) break;

		if (!afterSeen) {
			// Start processing from the node following the 'after' node.
			afterSeen = node === after;
			continue;
		}

		// We only care about element nodes.
		if (node.type != 'element') continue;

		// We only care about <script> and <style> elements.
		const tagName = node.tagName;
		if (tagName != 'script' && tagName != 'style') continue;

		// Ignore scripts and styles that don't contain anything.
		if (!node.children.length) continue;

		const attrs = node.attributes.filter(attr => attr.type == 'attribute');
		const elemId = attrs.find(attr => attr.name == 'id')?.value;
		if (useSections && hasSectionMarkers(tagName, node.innerHTML)) {
			// Split into feature files by section markers, keeping the order in an order file.
			const counter = tagName == 'script' ? scriptCounter++ : styleCounter++;
			const fallback = `${tagName}-${prefix}-${`${counter}`.padStart(3, '0')}`;
			outlineSections(node, parent, tagName, elemId && /^[^\s"'<>]+$/.test(elemId) ? elemId : fallback);
			continue;
		}
		if (tagName == 'script') {
			// Get the name from the id or generate a generic name.
			const fileName = getFileName('script', elemId, `${tagName}-${prefix}-${`${scriptCounter}`.padStart(3, '0')}`);

			// Analyze the embedded script and write it to a file.
			const actions = await analyzeAndWriteEmbedded(node, fileName);

			// Set the script element's src and clear the contents.
			node.addAttr(makeAttribute('src', fileName));
			node.children.length = 0;

			if (actions.length) {
				// Add a data attribute with the actions needed to return the content to its original form.
				node.addAttr(makeAttribute('data-actions', JSON.stringify(actions)));
			}

			scriptCounter += 1;
		} else {
			// Get the name from the id or generate a generic name.
			const fileName = getFileName('style', elemId, `${tagName}-${prefix}-${`${styleCounter}`.padStart(3, '0')}`);

			// Analyze the embedded stylesheet and write it to a file.
			const actions = await analyzeAndWriteEmbedded(node, fileName);

			// Replace the <style> element with a <link rel='stylesheet'> element.
			node.tagName = 'link';
			node.addAttr(makeAttribute('rel', 'stylesheet'));
			node.addAttr(makeAttribute('href', fileName));

			if (actions.length) {
				// Add a data attribute with the actions needed to return the content to its original form.
				node.addAttr(makeAttribute('data-actions', JSON.stringify(actions)));
			}

			styleCounter += 1;
		}
	}
}

/**
 * Outlines HTML regions marked with `<!-- split: path -->` ... `<!-- /split: path -->` into the file
 * `path` (relative to the split directory, `.html` appended if missing), replacing each region (markers included) with `<!-- split-include: name [actions] -->`.
 * Regions may be nested; inner regions become include markers inside the outer partial.
 *
 * @param {string} html
 */
async function outlineHtmlPartials(html) {
	// Validate all markers first (malformed markers would silently be ignored otherwise).
	checkHtmlMarkers(html);

	// Build a tree of marked regions.
	/** @typedef {{ name: string; offset: number; children: (string | Region)[] }} Region */
	/** @type {Region} */
	const root = { name: '', offset: 0, children: [] };
	const stack = [root];
	let last = 0;
	for (const m of html.matchAll(reHtmlMarker)) {
		const [marker, isEnd, name] = m;
		stack.at(-1).children.push(html.slice(last, m.index));
		last = m.index + marker.length;
		if (!isEnd) {
			if (!isValidSplitName(name)) throw new Error(`Invalid split name '${name}' at line ${lineOf(html, m.index)}!`);
			const region = { name, offset: m.index, children: [] };
			stack.at(-1).children.push(region);
			stack.push(region);
		} else {
			const open = stack.at(-1);
			if (open === root) throw new Error(`Unexpected '${marker}' at line ${lineOf(html, m.index)}!`);
			if (open.name != name) {
				throw new Error(`'${marker}' at line ${lineOf(html, m.index)} does not match '<!-- split: ${open.name} -->'!`);
			}
			stack.pop();
		}
	}
	stack.at(-1).children.push(html.slice(last));
	if (stack.length > 1) {
		const open = stack.at(-1);
		throw new Error(`Unclosed '<!-- split: ${open.name} -->' at line ${lineOf(html, open.offset)}!`);
	}

	/**
	 * @param {Region} region
	 * @returns {Promise<string>}
	 */
	async function serializeRegion(region) {
		let out = '';
		for (const child of region.children) {
			if (typeof child == 'string') {
				out += child;
			} else {
				const { text, actions } = outdent(await serializeRegion(child));
				const include = htmlInclude(child.name, actions);
				if (include.indexOf('-->') != include.length - 3) throw new Error(`Cannot encode actions for '${child.name}'!`);
				await writeSplitFile(splitNameToPath('html', child.name), text);
				out += include;
			}
		}
		return out;
	}

	return serializeRegion(root);
}

// Remove any existing output files.
await rm(splitDir, { recursive: true, force: true });

// Create the output directory.
await mkdir(splitDir, { recursive: true });

// Outline the script and style elements in <html> before <head>.
await outlineScriptAndStyleElems('0html', htmlOrDoc, { until: head });

// Outline the script and style elements in <head>.
await outlineScriptAndStyleElems('1head', head);

// Outline the script and style elements in <body>.
await outlineScriptAndStyleElems('2body', body);

// Outline the script and style elements in <html> after <body>.
await outlineScriptAndStyleElems('3html', htmlOrDoc, { after: body });

// Reference the feature files from the split HTML, so it can be run as it is (with the HTML partials kept inline):
// after each emptied element, a <script src> / <link rel="stylesheet"> for every feature file whose first section is
// in that element. join removes these again (they are marked with data-split-load).
// (Each file is a separate script here: see the readme for what that means for the order in which code runs.)
/** @type {Set<string>} */
const loadedFiles = new Set();
for (const { tag, entries, node, parent } of orderElements) {
	const at = parent.children.indexOf(node);
	const before = parent.children[at - 1];
	const indent = (before?.type == 'string' && /(?:^|\n)([ \t]*)$/.exec(before.content)?.[1]) || '';
	let tags = '';
	for (const { name } of entries) {
		const path = splitNameToPath(tag, name);
		if (loadedFiles.has(path)) continue;
		loadedFiles.add(path);
		tags +=
			`\n${indent}` +
			(tag == 'script'
				? `<script src="${path}" ${LOAD_ATTR}></script>`
				: `<link rel="stylesheet" href="${path}" ${LOAD_ATTR}>`);
	}
	if (tags) parent.children.splice(at + 1, 0, makeString(tags));
}

// Write the files that received sections, and the order file.
for (const [path, { kind, sections }] of sectionFiles) {
	const lines = sections.flatMap((section, k) => (k ? [SECTION_SEPARATOR, ...section] : section));
	await writeSplitFile(path, lines.length ? lines.join('\n') + '\n' : '');
}
if (orderElements.length) {
	if (writtenFiles.has(splitPathKey(ORDER_FILE))) throw new Error(`A split file is named '${ORDER_FILE}'!`);
	await writeFileDeep(`${splitDir}/${ORDER_FILE}`, lfToEol(serializeOrder(htmlFile, orderElements), eol));
}

// Serialize the updated parse tree and outline marked HTML regions.
let output = serialize(document);
if (outlineHtml) output = await outlineHtmlPartials(output);

// Write the updated html file to the output directory.
await writeFile(`${splitDir}/${htmlFile}`, lfToEol(output, eol));

// Summarize.
/** @type {Record<string, number>} */
const counts = {};
for (const file of writtenFiles.values()) {
	const ext = file.slice(file.lastIndexOf('.') + 1);
	counts[ext] = (counts[ext] ?? 0) + 1;
}
console.log(
	`Split ${htmlFile} into ${splitDir}/: ${Object.entries(counts).map(([ext, n]) => `${n} ${ext}`).join(', ') || 'nothing to outline'}` +
		(sectionCounter ? ` (${sectionCounter} sections, order in ${ORDER_FILE})` : '') +
		(outlineHtml ? '' : ' (HTML partials kept inline)'),
);
if (outlineHtml && [...writtenFiles.values()].some(file => /\.html?$/.test(file))) {
	console.log(
		`${splitDir}/${htmlFile} only references the HTML partials, so it cannot be opened directly. Use 'npm run dev' to\n` +
			`edit with automatic joining and a local server, or 'npm run split:runnable' (HTML kept inline) for a split copy\n` +
			`that opens directly in a browser.`,
	);
}
