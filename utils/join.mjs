import { realpathSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
	LOAD_ATTR,
	ORDER_FILE,
	checkHtmlMarkers,
	htmlBegin,
	htmlEnd,
	isValidSplitName,
	parseOrder,
	readAndRestore,
	crlfToLf,
	detectEol,
	lfToEol,
	reHtmlInclude,
	reHtmlMarker,
	reSectionMarker,
	reSectionMarkerLike,
	reSectionSeparator,
	SECTION_SEPARATOR,
	reSectionSeparatorLike,
	indentSection,
	sectionMarker,
	splitNameToPath,
	splitPathKey,
} from './common.mjs';
import { makeString, parse, serialize } from './parser.mjs';

/** @import * as t from './parser.mjs' */
/** @import * as c from './common.mjs' */

/**
 * Joins the split files of `htmlFile` (from `split/<name>/`) back into a single HTML document.
 *
 * @param {string} htmlFile
 * @returns {Promise<string>} The joined HTML.
 */
export async function joinHtml(htmlFile) {
	// Split files directory.
	const splitDir = `split/${htmlFile.slice(0, -5)}`;

	// The joined file gets the line endings of the split HTML file; the split files may use either (see common.mjs).
	let rawSplitHtml;
	try {
		rawSplitHtml = await readFile(`${splitDir}/${htmlFile}`, { encoding: 'utf-8' });
	} catch {
		throw new Error(`Missing ${splitDir}/${htmlFile} (run 'npm run split' first)!`);
	}
	const { eol } = detectEol(rawSplitHtml);

	// Files in the split directory that were used (to detect files whose content would be lost).
	/** @type {Map<string, string>} Portable path key -> original path. */
	const usedFiles = new Map();
	/** @param {string} path */
	const markUsedFile = path => {
		const key = splitPathKey(path);
		const previous = usedFiles.get(key);
		if (previous !== undefined && previous != path) {
			throw new Error(`Split paths '${previous}' and '${path}' differ only by letter case and are not portable!`);
		}
		usedFiles.set(key, path);
	};

	/**
	 * Replaces every `<!-- split-include: path [actions] -->` with the restored contents of that file,
	 * wrapped in `<!-- split: path -->` ... `<!-- /split: name -->`. Nested includes are resolved recursively.
	 *
	 * @param {string} html
	 * @param {string[]} [parents] Names of the partials currently being inlined (to detect cycles).
	 * @returns {Promise<string>}
	 */
	async function inlineHtmlPartials(html, parents = []) {
		// The include markers written by split, and `<!-- split: path -->` markers without a matching end marker, which
		// include a file (added by hand in a split file, so new files can be added without splitting again).
		const includes = [
			...[...html.matchAll(reHtmlInclude)].map(m => ({ m, name: m[1], actionsJson: m[2], byHand: false })),
			...[...html.matchAll(reHtmlMarker)]
				.filter(m => !m[1] && html.indexOf(htmlEnd(m[2]), m.index) == -1)
				.map(m => ({ m, name: m[2], actionsJson: undefined, byHand: true })),
		].sort((x, y) => x.m.index - y.m.index);
		let out = '';
		let last = 0;
		for (const { m, name, actionsJson, byHand } of includes) {
			const marker = m[0];
			if (!isValidSplitName(name)) throw new Error(`Invalid split name '${name}'!`);
			if (parents.includes(name)) throw new Error(`Recursive split include '${name}'!`);

			/** @type {c.Action[]} */
			const actions = actionsJson ? JSON.parse(actionsJson) : [];
			const fileName = splitNameToPath('html', name);
			const content = await readAndRestore(`${splitDir}/${fileName}`, actions);
			if (content === undefined) throw new Error(`Missing HTML partial '${fileName}'!`);
			const fileKey = splitPathKey(fileName);
			if (usedFiles.has(fileKey)) throw new Error(`HTML partial '${fileName}' is included more than once!`);
			markUsedFile(fileName);
			const inner = await inlineHtmlPartials(content, [...parents, name]);

			out += html.slice(last, m.index);
			last = m.index + marker.length;
			const lineStart = html.lastIndexOf('\n', m.index - 1) + 1;
			const lineEnd = html.indexOf('\n', last);
			const indent = html.slice(lineStart, m.index);
			if (byHand && /^[ \t]*$/.test(indent) && !html.slice(last, lineEnd == -1 ? html.length : lineEnd).trim()) {
				// On a line of its own: put the markup between the markers on lines of their own, indented like the marker.
				const lines = inner.replace(/\n$/, '').split('\n').map(line => (line.trim() ? indent + line : line));
				out += `${htmlBegin(name)}\n${inner ? `${lines.join('\n')}\n` : ''}${indent}${htmlEnd(name)}`;
			} else {
				out += htmlBegin(name) + inner + htmlEnd(name);
			}
		}
		return out + html.slice(last);
	}

	// Read the source file from the output directory and inline the HTML partials.
	const src = await inlineHtmlPartials(crlfToLf(rawSplitHtml));

	// Parse the file into a custom parse tree.
	const document = parse(src);

	// Remove the elements that split added to load the feature files, with the line break before each.
	/** @param {t.Element} parent */
	const removeLoaders = parent => {
		for (let i = parent.children.length - 1; i >= 0; i--) {
			const child = parent.children[i];
			if (child.type != 'element') continue;
			if (!child.attributes.some(attr => attr.type == 'attribute' && attr.name == LOAD_ATTR)) {
				removeLoaders(child);
				continue;
			}
			// The text before it ('\n' + indentation) can be spread over several string nodes.
			let start = i;
			while (parent.children[start - 1]?.type == 'string' && /^[ \t]*$/.test(parent.children[start - 1].content)) start--;
			const newline = parent.children[start - 1];
			if (newline?.type == 'string' && newline.content.endsWith('\n')) {
				if (newline.content == '\n') start--;
				else newline.content = newline.content.slice(0, -1);
			} else {
				start = i; // not written by split: only remove the element
			}
			parent.children.splice(start, i - start + 1);
			i = start;
		}
	};
	removeLoaders(document);

	// Get the outer <html> tag, if any, or fall back to the document root.
	const htmlOrDoc =
		document.children.filter(node => node.type == 'element').find(node => node.tagName == 'html') ?? document;

	// Get the <head> tag, if any.
	const head = htmlOrDoc.children.filter(node => node.type == 'element').find(node => node.tagName == 'head');

	// Get the <body> tag, if any.
	const body = htmlOrDoc.children.filter(node => node.type == 'element').find(node => node.tagName == 'body');

	/**
	 * @param {t.Element} node
	 * @param {string} fileName
	 */
	async function readAndRestoreOutlined(node, fileName) {
		// Note: split appends its attributes (src/rel/href, then data-actions) at the end of the start tag, so the *last*
		// attribute of each name is removed here; this keeps pre-existing attributes with the same name intact.

		// Get the actions (if any) needed to restore the embedded script or stylesheet to its original form.
		const attrs = node.attributes.filter(attr => attr.type == 'attribute');
		const actionsAttr = attrs.findLast(attr => attr.name == 'data-actions');
		/** @type {c.Action[]} */
		const actions = actionsAttr ? JSON.parse(actionsAttr.value) : [];

		// Read the outlined file and restore its original form.
		const content = await readAndRestore(`${splitDir}/${fileName}`, actions);
		if (content === undefined) return false; // File not found, skip this element.
		markUsedFile(fileName);

		// Remove the data attribute.
		if (actionsAttr) node.removeAttr('data-actions', true);

		// Embed the content.
		node.children.push(makeString(content));

		// Report success.
		return true;
	}

	// ---------- sections (see common.mjs): elements whose code was split into feature files by section markers
	/** @type {Map<string, c.OrderElement> | null} */
	let order = null;
	/** @type {Set<string>} */
	const usedElements = new Set();
	/**
	 * @type {Map<string, { path: string; sections: string[][]; used: number; included?: boolean }>}
	 * Portable path key -> file.
	 */
	const sectionFiles = new Map();

	async function getOrder() {
		if (!order) {
			let text;
			try {
				text = await readFile(`${splitDir}/${ORDER_FILE}`, { encoding: 'utf-8' });
			} catch {
				throw new Error(`Missing ${splitDir}/${ORDER_FILE} (needed to join sections back in order)!`);
			}
			order = parseOrder(crlfToLf(text));
		}
		return order;
	}

	/**
	 * @param {'script' | 'style'} kind
	 * @param {string} path
	 * @param {string} [from] Where the file is referenced (for the error message if it is missing).
	 */
	async function getSections(kind, path, from = `listed in ${ORDER_FILE}`) {
		const key = splitPathKey(path);
		let file = sectionFiles.get(key);
		if (file) {
			if (file.path != path) {
				throw new Error(`Split paths '${file.path}' and '${path}' differ only by letter case and are not portable!`);
			}
			return file;
		}
		let text;
		try {
			text = await readFile(`${splitDir}/${path}`, { encoding: 'utf-8' });
		} catch {
			throw new Error(`Missing split file '${path}' (${from})!`);
		}
		// (split writes an empty file as '' and anything else with a final newline.)
		text = crlfToLf(text);
		const lines = text ? (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n') : [];
		const reSeparator = reSectionSeparator;
		/** @type {string[][]} */
		const sections = [[]];
		lines.forEach((line, i) => {
			if (reSeparator.test(line)) {
				sections.push([]);
			} else if (reSectionSeparatorLike.test(line)) {
				throw new Error(
					`${path} line ${i + 1}: malformed section separator '${line.trim()}' (must be exactly ` +
						`'${SECTION_SEPARATOR}' at the start of the line)!` +
						(line.trim().startsWith('//') ? ` Split files made by an older version use '//': join them with that version and split again.` : ''),
				);
			} else {
				sections.at(-1).push(line);
			}
		});
		file = { path, sections, used: 0 };
		sectionFiles.set(key, file);
		return file;
	}

	/**
	 * Appends a section to `lines` the way it goes into the joined file: its marker line, then its lines (indented again).
	 * A `/* split: path *\/` line in a split .js/.css file includes the file `path` at that point, so new files
	 * can be added without splitting again: its code follows under its own marker, then the rest of the section
	 * continues under a new marker - exactly as if the markers had been added to the joined file.
	 *
	 * @param {'script' | 'style'} kind
	 * @param {string} name
	 * @param {string[]} section
	 * @param {string} marker Indentation of the marker line.
	 * @param {string} indent Indentation of the code.
	 * @param {string[]} parents Paths of the files being emitted (to detect cycles).
	 * @param {string[]} lines
	 */
	async function emitSection(kind, name, section, marker, indent, parents, lines) {
		const reMarker = reSectionMarker;
		const reLike = reSectionMarkerLike;
		/** @type {string[]} */
		let piece = [];
		let first = true;
		/** @param {boolean} includeFollows */
		const flush = includeFollows => {
			// No marker for a part without code next to an include (its blank lines simply stay where they are).
			const hasCode = piece.some(line => line.trim());
			if (first ? hasCode || !includeFollows : hasCode) lines.push(marker + sectionMarker(name));
			lines.push(...indentSection(piece, indent));
			piece = [];
			first = false;
		};
		for (const line of section) {
			const m = reMarker.exec(line);
			if (!m) {
				if (reLike.test(line)) {
					throw new Error(
						`'${parents.at(-1)}': malformed include '${line.trim()}' (use '${sectionMarker('path/to/file')}')!`,
					);
				}
				piece.push(line);
				continue;
			}
			const [, extra, includeName] = m;
			if (!isValidSplitName(includeName)) throw new Error(`'${parents.at(-1)}': invalid split name '${includeName}'!`);
			const path = splitNameToPath(kind, includeName);
			if (parents.includes(path)) throw new Error(`Recursive include of '${path}' in '${parents.at(-1)}'!`);
			const file = await getSections(kind, path, `included in '${parents.at(-1)}'`);
			if (file.included || file.used) throw new Error(`'${path}' is included more than once (or also listed in ${ORDER_FILE})!`);
			if (file.sections.length > 1) {
				throw new Error(`'${path}' is included with a '${sectionMarker(includeName)}' line, so it cannot have '@split-section' lines!`);
			}
			file.included = true;
			file.used = file.sections.length;
			flush(true);
			await emitSection(kind, includeName, file.sections[0], marker + extra, indent + extra, [...parents, path], lines);
		}
		flush(false);
	}

	/**
	 * Refills an element emptied by split from its sections, in the order recorded in the order file.
	 *
	 * @param {t.Element} node
	 * @param {'script' | 'style'} kind
	 * @param {string} key
	 */
	async function inlineSections(node, kind, key) {
		const element = (await getOrder()).get(key);
		if (!element || element.tag != kind) throw new Error(`<${kind} ${key}> is not listed in ${ORDER_FILE}!`);
		if (usedElements.has(key)) throw new Error(`Duplicate split element '${key}'!`);
		usedElements.add(key);
		const attrs = node.attributes.filter(attr => attr.type == 'attribute');
		const frameAttr = attrs.findLast(attr => attr.name == 'data-split-frame');
		/** @type {[string[], string[]]} */
		const [head, tail] = frameAttr ? JSON.parse(frameAttr.value) : [[], []];
		/** @type {string[]} */
		const lines = [...head];
		for (const { name, marker, indent } of element.entries) {
			const path = splitNameToPath(kind, name);
			const file = await getSections(kind, path);
			if (file.included) throw new Error(`'${path}' is included with a '${sectionMarker(name)}' line, but also listed in ${ORDER_FILE}!`);
			const section = file.sections[file.used++];
			if (!section) {
				throw new Error(
					`'${path}' has ${file.sections.length} section(s), but ${ORDER_FILE} lists more: ` +
						`was a '${SECTION_SEPARATOR}' line removed?`,
				);
			}
			await emitSection(kind, name, section, marker ?? '', indent ?? '', [path], lines);
		}
		lines.push(...tail);
		if (frameAttr) node.removeAttr('data-split-frame', true);
		node.removeAttr('data-split-sections', true);
		node.children.length = 0;
		node.children.push(makeString(lines.join('\n')));
	}

	/**
	 * @param {t.Element | undefined} parent
	 * @param {{ until?: t.Element; after?: t.Element }} [options]
	 */
	async function inlineScriptAndStyleElems(parent, options = {}) {
		if (!parent) return;

		const { until, after } = options;

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

			// We only care about <script>, <style> and <link> elements.
			const tagName = node.tagName;
			if (tagName != 'script' && tagName != 'style' && tagName != 'link') continue;

			const attrs = node.attributes.filter(attr => attr.type == 'attribute');
			const sectionsKey = attrs.findLast(attr => attr.name == 'data-split-sections')?.value;
			if (sectionsKey && (tagName == 'script' || tagName == 'style')) {
				// Reassemble an element that was split into sections.
				await inlineSections(node, tagName, sectionsKey);
				continue;
			}
			if (tagName == 'style') continue;
			if (tagName == 'script') {
				// Get the filename from the element's src; skip scripts without a src.
				const fileName = attrs.findLast(attr => attr.name == 'src')?.value;
				if (!fileName) continue;

				// Inline the script into the existing element.
				const inlined = await readAndRestoreOutlined(node, fileName);
				if (!inlined) continue;

				node.removeAttr('src', true);
			} else {
				// Skip link elements that aren't stylesheets.
				if (attrs.findLast(attr => attr.name == 'rel')?.value != 'stylesheet') continue;

				// Get the filename from the element's href; skip link elements without an href.
				const fileName = attrs.findLast(attr => attr.name == 'href')?.value;
				if (!fileName) continue;

				// Inline the stylesheet into the existing element.
				const inlined = await readAndRestoreOutlined(node, fileName);
				if (!inlined) continue;

				// Turn the <link rel='stylesheet'> element into a <style> element.
				node.tagName = 'style';
				node.removeAttr('href', true);
				node.removeAttr('rel', true);
			}
		}
	}

	// Inline the script and style elements in <html> before <head>.
	await inlineScriptAndStyleElems(htmlOrDoc, { until: head });

	// Inline the script and style elements in <head>.
	await inlineScriptAndStyleElems(head);

	// Inline the script and style elements in <body>.
	await inlineScriptAndStyleElems(body);

	// Inline the script and style elements in <html> after <body>.
	await inlineScriptAndStyleElems(htmlOrDoc, { after: body });

	// Every section must have been put back; otherwise code would silently disappear from the joined file.
	if (order) {
		for (const key of order.keys()) if (!usedElements.has(key)) throw new Error(`<${order.get(key).tag} ${key}> from ${ORDER_FILE} is missing in ${splitDir}/${htmlFile}!`);
	}
	for (const file of sectionFiles.values()) {
		const { path } = file;
		markUsedFile(path);
		if (file.used < file.sections.length) {
			throw new Error(
				`'${path}' has ${file.sections.length} sections, but ${ORDER_FILE} lists only ${file.used}, so code would be ` +
					`lost: was a '@split-section' line added? (To add code, put it in an existing section.)`,
			);
		}
	}
	// Code files that index.html does not use at all would be lost as well (for example a new file without a marker).
	/** @param {string} dir */
	const walk = async dir => {
		for (const entry of await readdir(`${splitDir}/${dir}`, { withFileTypes: true })) {
			const rel = dir ? `${dir}/${entry.name}` : entry.name;
			if (entry.isDirectory()) await walk(rel);
			else if (/\.(m?js|css|html?)$/.test(entry.name) && splitPathKey(rel) != splitPathKey(htmlFile)) {
				const usedAs = usedFiles.get(splitPathKey(rel));
				if (usedAs !== undefined) {
					if (usedAs != rel) {
						throw new Error(`Split paths '${usedAs}' and '${rel}' differ only by letter case and are not portable!`);
					}
					continue;
				}
				const [marker, where] = /\.css$/.test(rel)
					? [sectionMarker(rel), 'a .css file']
					: /\.html?$/.test(rel)
						? [`<!-- split: ${rel} -->`, `an .html file (or ${htmlFile})`]
						: [sectionMarker(rel), 'a .js file'];
				throw new Error(
					`'${rel}' is not used anywhere, so its content would be lost. To include it, add a line '${marker}' ` +
						`where it belongs in ${where} in ${splitDir}/ (or delete the file).`,
				);
			}
		}
	};
	await walk('');

	// Serialize the updated parse tree, and make sure the result can be split again.
	const output = serialize(document);
	try {
		checkHtmlMarkers(output);
	} catch (e) {
		const line = Number(/at line (\d+)/.exec(e.message)?.[1]);
		const text = line ? output.split('\n')[line - 1].trim().slice(0, 120) : '';
		throw new Error(`${e.message.replace(/at line \d+/, `at line ${line} of the joined ${htmlFile}`)}${text ? `\n  ${text}` : ''}`);
	}
	return lfToEol(output, eol);
}

// Command line: [file.html]. Writes the joined file over the original.
// (Compared as real paths, ignoring case on Windows, where e.g. the drive letter can differ in case.)
const isCommandLine = (() => {
	try {
		const self = realpathSync(fileURLToPath(import.meta.url));
		const main = realpathSync(process.argv[1]);
		return process.platform == 'win32' ? self.toLowerCase() == main.toLowerCase() : self == main;
	} catch {
		return false;
	}
})();
if (isCommandLine) {
	const htmlFile = process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? 'index.html';
	await writeFile(htmlFile, await joinHtml(htmlFile));
}
