import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

import { makeAttribute, parse, serialize } from './parser.mjs';

/** @import * as t from './parser.mjs' */

// Input/output html file name.
const htmlFile = process.argv[2] ?? 'index.html';

// Split files directory.
const splitDir = `split/${htmlFile.slice(0, -5)}`;

// Read the source file from the input directory.
const src = await readFile(htmlFile, { encoding: 'utf-8' });

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
async function analyzeAndWriteEmbedded(node, fileName) {
	// Split the embedded script or stylesheet into lines.
	let lines = node.innerHTML.split('\n');
	let n = lines.length;

	// Record the processing actions performed on the file.
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

	// Write the file, adding a single trailing newline.
	await writeFile(`${splitDir}/${fileName}`, lines.join('\n') + '\n');

	// Return the actions that were performed.
	return actions;
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
		if (tagName == 'script') {
			// Get the name from the id or generate a generic name.
			const elemId = attrs.find(attr => attr.name == 'id')?.value;
			const fileId = elemId || `${tagName}-${prefix}-${`${scriptCounter}`.padStart(3, '0')}`;
			const fileName = `${fileId}.js`;

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
			const elemId = attrs.find(attr => attr.name == 'id')?.value;
			const fileId = elemId || `${tagName}-${prefix}-${`${styleCounter}`.padStart(3, '0')}`;
			const fileName = `${fileId}.css`;

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

// Write the updated html file to the output directory.
await writeFile(`${splitDir}/${htmlFile}`, serialize(document));
