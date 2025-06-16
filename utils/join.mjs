import { readFile, writeFile } from 'node:fs/promises';

import { makeString, parse, serialize } from './parser.mjs';

/** @import * as t from './parser.mjs' */

// Input/output html file name.
const htmlFile = process.argv[2] ?? 'index.html';

// Split files directory.
const splitDir = `split/${htmlFile.slice(0, -5)}`;

// Read the source file from the output directory.
const src = await readFile(`${splitDir}/${htmlFile}`, { encoding: 'utf-8' });

// Parse the file into a custom parse tree.
const document = parse(src);

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
	// Read the outlined file and split it into lines.
	let lines;
	try {
		const content = await readFile(`${splitDir}/${fileName}`, { encoding: 'utf-8' });
		lines = content.split('\n');
	} catch {
		return false; // File not found, skip this element.
	}

	// Remove the trailing newline, if any.
	if (lines.at(-1) == '') lines.pop();

	// Get the actions (if any) needed to restore the embedded script or stylesheet to its original form.
	const attrs = node.attributes.filter(attr => attr.type == 'attribute');
	const actionsAttr = attrs.find(attr => attr.name == 'data-actions');
	if (actionsAttr) {
		/**
		 * @type {(
		 *   [action: 'leading', numLines: number] | [action: 'trailing', numLines: number] |
		 *   [action: 'indent', skipLines: number, indent: string]
		 * )[]}
		 */
		const actions = JSON.parse(actionsAttr.value);

		// Remove the data attribute.
		node.removeAttr('data-actions');

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
	}

	// Embed the content.
	node.children.push(makeString(lines.join('\n')));

	// Report success.
	return true;
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

		// We only care about <script> and <link> elements.
		const tagName = node.tagName;
		if (tagName != 'script' && tagName != 'link') continue;

		const attrs = node.attributes.filter(attr => attr.type == 'attribute');
		if (tagName == 'script') {
			// Get the filename from the element's src; skip scripts without a src.
			const fileName = attrs.find(attr => attr.name == 'src')?.value;
			if (!fileName) continue;

			// Inline the script into the existing element.
			const inlined = await readAndRestoreOutlined(node, fileName);
			if (!inlined) continue;

			node.removeAttr('src');
		} else {
			// Skip link elements that aren't stylesheets.
			if (attrs.find(attr => attr.name == 'rel')?.value != 'stylesheet') continue;

			// Get the filename from the element's href; skip link elements without an href.
			const fileName = attrs.find(attr => attr.name == 'href')?.value;
			if (!fileName) continue;

			// Inline the stylesheet into the existing element.
			const inlined = await readAndRestoreOutlined(node, fileName);
			if (!inlined) continue;

			// Turn the <link rel='stylesheet'> element into a <style> element.
			node.tagName = 'style';
			node.removeAttr('href');
			node.removeAttr('rel');
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

// Write the updated html file to the base directory.
await writeFile(htmlFile, serialize(document));
