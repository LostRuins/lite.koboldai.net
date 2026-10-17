// Development server: edit the split files, see the result in the browser.
//
// - Splits the HTML file first if there are no split files yet.
// - Watches `split/<name>/` and joins the split files back into the HTML file whenever something changes.
// - Serves the (joined) HTML file and the other files of the repository on http://localhost:8080/.
//
// Command line: [file.html] [--port <port>] [--host <host>]
// Uses only Node.js built-ins.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

import { joinHtml } from './join.mjs';

// ---------- command line
const args = process.argv.slice(2);
/** @param {string} name */
function option(name, fallback) {
	const i = args.indexOf(name);
	if (i == -1) return fallback;
	const value = args[i + 1];
	if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for '${name}'!`);
	args.splice(i, 2);
	return value;
}
const port = Number(option('--port', '8080'));
const host = option('--host', 'localhost');
for (const arg of args) if (arg.startsWith('--')) throw new Error(`Unknown option '${arg}'!`);
const htmlFile = args[0] ?? 'index.html';
const splitDir = `split/${htmlFile.slice(0, -5)}`;
const root = resolve('.');

const log = (...msg) => console.log(`[${new Date().toLocaleTimeString()}]`, ...msg);

// ---------- file state helpers
/** Newest modification time and a signature (paths, sizes, mtimes) of all files below `dir`. */
function scan(dir) {
	let newest = 0;
	const parts = [];
	const walk = d => {
		for (const entry of readdirSync(d, { withFileTypes: true })) {
			const path = join(d, entry.name);
			if (entry.isDirectory()) walk(path);
			else if (entry.isFile()) {
				const st = statSync(path);
				newest = Math.max(newest, st.mtimeMs);
				parts.push(`${path}:${st.size}:${st.mtimeMs}`);
			}
		}
	};
	walk(dir);
	return { newest, signature: parts.sort().join('\n') };
}
const exists = path => { try { statSync(path); return true; } catch { return false; } };
const readText = path => readFileSync(path, 'utf-8');

// ---------- initial synchronisation
if (!exists(htmlFile)) throw new Error(`'${htmlFile}' not found (run this from the repository root)!`);
if (!exists(splitDir)) {
	log(`No split files yet, splitting ${htmlFile}...`);
	execFileSync(process.execPath, ['utils/split.mjs', htmlFile], { stdio: 'inherit' });
} else {
	const joined = await joinHtml(htmlFile);
	if (joined != readText(htmlFile)) {
		if (scan(splitDir).newest > statSync(htmlFile).mtimeMs) {
			writeFileSync(htmlFile, joined);
			log(`Joined pending changes from ${splitDir}/ into ${htmlFile}.`);
		} else {
			console.error(
				`${htmlFile} was changed after it was split (for example by a git pull), so ${splitDir}/ is out of date.\n` +
					`  - run 'npm run split' to re-split it (discards changes in ${splitDir}/ that were not joined), or\n` +
					`  - run 'npm run join' to overwrite ${htmlFile} with the split files.\n` +
					`Then start 'npm run dev' again.`,
			);
			process.exit(1);
		}
	}
}

// ---------- watch and join
let lastSplit = scan(splitDir).signature;
let lastHtml = readText(htmlFile); // content of the HTML file as last written/seen by us
/** @type {string | null} */
let joinError = null;
let paused = false;

/** Pauses automatic joining if the source HTML no longer matches the last version observed or written by this server. */
function pauseIfHtmlChanged() {
	let current;
	try {
		current = readText(htmlFile);
	} catch {
		current = null; // Deleting or making the file unreadable is an external change too.
	}
	if (current == lastHtml) return false;
	paused = true;
	log(
		`${htmlFile} was changed outside of ${splitDir}/; automatic joining is paused so nothing gets overwritten.\n` +
			`  Stop the server, run 'npm run split' (or 'npm run join'), then start 'npm run dev' again.`,
	);
	return true;
}

async function rejoin() {
	try {
		const joined = await joinHtml(htmlFile);
		joinError = null;
		if (joined != lastHtml) {
			// joinHtml performs asynchronous reads. Check again immediately before writing so an external edit made while
			// the join was in progress is never replaced with stale output.
			if (pauseIfHtmlChanged()) return;
			writeFileSync(htmlFile, joined);
			lastHtml = joined;
			log(`Joined into ${htmlFile}.`);
		} else {
			log('No change in the joined output.');
		}
	} catch (e) {
		joinError = e instanceof Error ? e.message : String(e);
		log(`Join failed, ${htmlFile} was not updated: ${joinError}`);
	}
}

let busy = false;
setInterval(async () => {
	if (busy || paused) return;
	busy = true;
	try {
		// The HTML file must only be changed by us while the dev server runs; otherwise stop before overwriting anything.
		if (pauseIfHtmlChanged()) return;
		const { signature } = scan(splitDir);
		if (signature != lastSplit) {
			lastSplit = signature;
			await new Promise(r => setTimeout(r, 100)); // let editors finish writing
			lastSplit = scan(splitDir).signature;
			await rejoin();
		}
	} catch (e) {
		log(`Watcher error: ${e instanceof Error ? e.message : e}`);
	} finally {
		busy = false;
	}
}, 300);

// ---------- static server
const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.webp': 'image/webp',
	'.txt': 'text/plain; charset=utf-8',
};
const escapeHtml = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

const server = createServer((req, res) => {
	let path;
	try {
		path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
	} catch {
		res.writeHead(400).end();
		return;
	}
	if (path.endsWith('/')) path += htmlFile;
	const file = resolve(root, '.' + path);
	if (file != root && !file.startsWith(root + sep)) {
		res.writeHead(403).end();
		return;
	}
	const headers = { 'cache-control': 'no-store' };
	if (joinError && file == resolve(root, htmlFile)) {
		res.writeHead(500, { ...headers, 'content-type': TYPES['.html'] });
		res.end(`<!DOCTYPE html><title>Join failed</title><h2>Joining ${escapeHtml(splitDir)}/ failed</h2>` +
			`<pre>${escapeHtml(joinError)}</pre><p>Fix the split files; the page is rebuilt automatically, then reload.</p>`);
		return;
	}
	let data;
	try {
		if (!statSync(file).isFile()) throw new Error();
		data = readFileSync(file);
	} catch {
		res.writeHead(404, { ...headers, 'content-type': TYPES['.txt'] }).end('Not found');
		return;
	}
	res.writeHead(200, { ...headers, 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
	res.end(req.method == 'HEAD' ? undefined : data);
});
server.listen(port, host, () => {
	log(`Serving ${htmlFile} on http://${host}:${port}/`);
	log(`Watching ${splitDir}/ - changes are joined into ${htmlFile} automatically. Press Ctrl+C to stop.`);
});
