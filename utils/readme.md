## These are scripts to split and join the main html for easier editing

### Note for contributors:
- This tool is intended to help segment the HTML file for easier editing during development. However, any pull requests MUST be submitted in the original single HTML file format.

To run them:
1. Run `npm install` to install the `html-lexer` dependency (which itself is dependency free)
2. Run `npm run split` or `npm run split index.html` to generate the split files from the monolithic HTML
3. The split files are placed in directory `split` (subdirectory `index` for `index.html`) and are untracked
4. Run `npm run join` or `npm run join index.html` to turn the split files back into the monolithic HTML, replacing the original file

The easiest way to work on the split files is the development server:

```
npm run dev
```

It splits `index.html` if needed, joins the split files back into `index.html` automatically whenever you save one of
them, and serves the page on http://localhost:8080/ (reload the browser to see your changes). See
[Development server](#development-server).

`npm run split:runnable` (or `npm run split -- --no-html`) splits like `npm run split` but keeps the HTML markup inline,
so the split `index.html` loads the feature files and can be opened in a browser directly (see [Running the split files](#running-the-split-files)).

### Folder structure

The split tool does not hardcode any folders: **every path is defined inside the monolithic HTML**, so changing the
structure only requires editing `index.html`.

- **Code sections** (used by `index.html`): a line `/* split: src/import/tavern.js */` inside a `<script>` or `<style>`
  starts a section that is written to that path, up to the next marker. JavaScript and CSS use the same `/* */` comment
  syntax (CSS has no `//` comments); only markup uses `<!-- -->`. Several sections can go to the same file, so code that
  belongs together ends up in one file **while `index.html` keeps its original order** - see
  [Code sections and the order file](#code-sections-and-the-order-file).
- **Scripts and stylesheets without section markers**: the `id` of the element is its path relative to the split
  directory, e.g. `<script id="src/foo/bar.js">` is written to `split/index/src/foo/bar.js`. If the id does not end in
  `.js`/`.mjs` (scripts) or `.css` (styles), that extension is appended, so plain ids like `<script id="main">` produce
  `main.js`. Elements without an id (or with an id that is not a valid relative path) get a generated name such as
  `script-1head-000.js`.
- **HTML markup**: a region wrapped in `<!-- split: src/world-info/world-info-tab.html -->` ...
  `<!-- /split: src/world-info/world-info-tab.html -->` is written to that path (`.html` is appended if missing).
  Regions may be nested; an inner region becomes an include marker inside the outer file. Both markers must have the
  same parent element.

All markers must be written exactly in the form shown (one space after `//`, `/*` or `<!--`, after `split:` and before
`*/` or `-->`); malformed markers are reported as errors instead of being ignored.

Paths may only contain letters, digits, `_`, `-`, `.` and `/` (no `..` or empty segments). Element and HTML region
paths must be unique without regard to letter case (`src/Foo.js` and `src/foo.js` conflict), so split output stays
portable between case-sensitive and case-insensitive file systems.

`index.html` uses a feature-based layout, grouped by use case like a regular front-end project (the markers only add
lines to `index.html`; nothing in it is moved):

```
split/index/
├── index.html            the remaining page skeleton, referencing everything below
├── split-order.txt       where each code section goes back in index.html
└── src/
    ├── vendor/           third-party libraries (temml, lzma, zlib, lunr stemmer, minisearch, lamejs, bootstrap css)
    ├── styles/           global css: variables, themes, base layout, scrollbars/backgrounds, print, colors
    ├── utils/            generic helpers: encoding, strings, dom, async, markdown, audio, device
    ├── config/           init-config, assets, defaults, endpoints, models, global state, settings
    ├── app/              startup (init), url params, lifecycle, notifications, navigation, pwa-setup
    ├── api/              backend connections: headers, connect, capabilities, endpoint popup + selector,
    │                     kobold/, openai/, claude/, cohere/, koboldcpp/ (admin, perf, tokenize)
    ├── horde/            AI Horde models, workers, account/kudos
    ├── generation/       text generation pipeline: submit, payload, dispatch, streaming, polling, incoming,
    │                     instruct tags/presets, thinking, placeholders, abort, idle responses, logprobs, decensor
    ├── image-gen/        generate + one file per image backend (horde, a1111, comfyui, pollinations, dalle)
    ├── media/            media rendering, zoomed media, vision; input/ (upload, paste, webcam, microphone)
    ├── tts/              text to speech        voice-input/   speech to text
    ├── tools/            custom tools + editor, slash commands, tool calls; mcp/ (client, tools)
    ├── import/           file loader + one file per importer (kobold, tavern, kaistory, risu, agnai, novelai,
    │                     aidungeon, ooba, llamacpp, lorebook) and advanced load
    ├── storage/          indexeddb, compressed stories, autosave, save files, save slots
    ├── share/            share.js, share.html, choose-share.html
    ├── scenarios/        scenario db + sources, scenarios, character creator, quickstart
    ├── world-info/       world info logic, import/export, world-info tab
    ├── memory/           memory, auto summary, context popup + memory tab
    ├── textdb/           TextDB, embeddings, search      websearch/   wordsearch/
    ├── multiplayer/      groupchat/       samplers/       session/ (new game, undo/redo, branches)
    ├── settings/         settings popup, tabs/, display/apply, modes, api keys, regex replacers
    ├── editor/           edit mode           customization/   user css and mods
    └── ui/               ui mode, popups, dialogs, theme, side panels, action bar, loaders, tooltips;
                          top-menu/, welcome/, layout/, gametext/, dialogs/,
                          classic/, messenger/, corpo/, aesthetic/ (each with its .js, .css and .html)
```

### Code sections and the order file

The split files are only a different *view* of `index.html`: every piece of code goes back exactly where it was.

- Most files hold a single section and contain just code. When a file holds code from several places in `index.html`,
  the parts are separated by a line `/* @split-section */` (in both `.js` and `.css` files), written by `split`. There are no
  numbers or names to look up: the parts of a file are simply in their `index.html` order.
- `split/index/split-order.txt` lists, for every `<script>`/`<style>` element with sections, the file of each section in
  their order in `index.html`; the 1st, 2nd, 3rd... time a file is listed is its 1st, 2nd, 3rd... part. `join`
  reassembles every element from this list, so the five parts of `src/import/tavern.js` end up between the other
  importers, just like in the original file. The file is generated; you never need to read or edit it.
- Section code is written without the indentation it had in `index.html`; the order file records it (`{"indent": ...}`,
  only where it differs from the element's usual indentation) and `join` adds it back.

Editing works as usual: edit code anywhere in a file and it is joined back at that position. In addition:

- **New code** goes into the part (in whichever file) after which it should appear in `index.html`; code added at the
  end of a file goes after its last part.
- **Move code to another position**: move it into another part (of the same or another file); it then goes to that
  part's position.
- **Add a new file** - no need to split again: create it in the split directory and put a line with its path where it
  belongs in one of the split files, using the same marker syntax as in `index.html`:
    - `/* split: src/memory/notes.js */` in a `.js` file (e.g. between two functions), `/* split: src/memory/notes.css */`
      in a `.css` file: the new file's code goes into `index.html` at that point, and the rest of the file continues after
      it. The new file can include further new files the same way.
    - `<!-- split: src/memory/notes.html -->` in an `.html` file (or the split `index.html`): the markup goes there. When
      the line has nothing else on it, the markup is indented like the line.

  `join` turns the line into a normal `split:` region in `index.html`; the next `npm run split` treats it like any
  other file (and the line disappears again, as the file is then part of the regular layout).
- **Move or rename a file**: move it, then change its path in `split-order.txt` (on every line where it appears) for a
  `.js`/`.css` file, or in the `<!-- split-include: ... -->` line that includes it for an `.html` file. The markers in
  `index.html` are renamed accordingly on the next join. (Alternatively, change the path in the markers in `index.html`
  and split again.)
- **Move code to another file without moving it in `index.html`**: cut it into a new file at the same spot and include
  that file there (see above).
- **Do not add, remove or reorder** the `@split-section` lines or the lines of `split-order.txt`. `join` refuses to run
  (and leaves `index.html` untouched, with a message saying what is wrong) if a separator is malformed, if a file has
  more or fewer parts than listed, if a listed or included file is missing or is used twice, or if a code or HTML file
  in the split directory is not used anywhere - so no code can get lost.

The runnable copy (`npm run split:runnable`) only loads the files that existed when it was split; after adding a file,
join and run `npm run split:runnable` again (or use `npm run dev`, which always serves the joined file).

Use `npm run split -- --no-sections` to ignore the section markers and write each element to a single file, as before.

### How it works

The `split` script works as follows:
1. Parse the input HTML file into a custom parse tree
2. For every `<script>` and `<style>` element with section markers (unless `--no-sections` is given):
    1. Cut the contents at the markers, remove the common indentation of each section and append it to the file named
       by its marker (after a `@split-section` separator if that file already has a section)
    2. Record the order of the sections in `split-order.txt` and empty the element, marking it with
       `data-split-sections` (and the surrounding whitespace in `data-split-frame`)
    3. After it, add a `<script src>` / `<link rel="stylesheet">` (marked `data-split-load`) for every file whose first
       section is in this element
3. For every other `<script>` element with contents (directly in `<head>`, `<body>` or `<html>`):
    1. Get the target path from the `id` attribute (adding `.js` if needed) or generate one
    2. Remove extra leading and trailing newlines and indentation
    3. Record the details of the changes in a `data-actions` attribute
    4. Write the embedded JS to the target file, creating folders as needed
    5. Reference the outlined JS through the `src` attribute
4. For every other `<style>` element with contents:
    1. Get the target path from the `id` attribute (adding `.css` if needed) or generate one
    2. Remove extra leading and trailing newlines and indentation
    3. Record the details of the changes in a `data-actions` attribute
    4. Write the embedded CSS to the target file, creating folders as needed
    5. Turn the `<style>` element into a `<link rel="stylesheet">` element
    6. Reference the outlined CSS through the `href` attribute
5. Serialize the updated parse tree
6. Unless `--no-html` is given, for every `<!-- split: path -->` region (innermost first):
    1. Remove extra leading and trailing newlines and indentation
    2. Write the markup to `path` (adding `.html` if needed)
    3. Replace the region, including its markers, with `<!-- split-include: path [actions] -->`
7. Write the HTML file

The `join` script reverses the process: it first expands the `split-include` markers (recursively, restoring the
`<!-- split -->` markers around the inlined markup), then removes the `data-split-load` elements, reassembles the sectioned elements from `split-order.txt`
(expanding `split:` lines added to the split files), applies the `data-actions` and inlines the other
JS and CSS (removing
the previously added attributes and turning `<link rel="stylesheet">` back into `<style>`). Splitting and joining an
unmodified file reproduces it byte for byte.

Line endings: the split files get the line endings of the HTML file (CRLF in a Windows checkout with git's
`core.autocrlf`, LF otherwise). `join` accepts either in the split files, whatever your editor saves, and writes the HTML
file with the line endings of `split/index/index.html`. A file that mixes CRLF and LF is converted to the most common one
(`split` prints a note); browsers and JavaScript treat both the same.

### Development server

`npm run dev` (options: `npm run dev -- [file.html] [--port 8080] [--host localhost]`) only uses Node.js built-ins:

1. If there are no split files yet, it runs `split` first.
2. It watches `split/index/` and runs `join` after every change. The page is served from the joined `index.html`, so
   what you see in the browser is exactly the file you would commit. Reload the page after saving.
3. If a join fails (for example because of a malformed `<!-- split: ... -->` marker), `index.html` is left untouched
   and the browser shows the error instead of the page until it is fixed.
4. It never overwrites changes it did not make: if `index.html` is newer than the split files when the server starts
   (for example after a `git pull`), it stops and asks you to run `npm run split` or `npm run join` first; if
   `index.html` is changed while the server runs, automatic joining is paused. Changes saved in the split files while
   the server was not running are joined when it starts.

A local server is needed because browsers do not let a page opened from disk (`file://`) read other local files, so
the outlined HTML files cannot be loaded by the page itself.

### Running the split files

When split with `npm run split:runnable` (`--no-html`), you can open `split/index/index.html` in your browser directly,
just like the original (also from disk, without a server). The split `index.html` loads the feature files themselves - after
each emptied `<script>`/`<style>` there is a `<script src="src/...">` / `<link rel="stylesheet" href="src/...">` for every
file whose first section is in that element (marked `data-split-load`; `join` removes them again) - so the files you edit
are the files that run, and each one shows up under its own name in the browser's developer tools. Edit, reload, and run
`npm run join` when done. With HTML partials outlined (the default), the split `index.html` only contains include markers
for the markup; use `npm run dev` instead.

The joined `index.html` always runs the code in its original order. In the runnable copy, each feature file is a
separate script, loaded where its *first* section is, so its later sections run earlier than in `index.html`. For the
current layout this makes no difference (verified: same statements, nothing runs before what it uses, the same CSS rules
in the same order apart from one unique `@keyframes`, identical screenshots). When adding code, keep in mind that:
- code that runs immediately (not inside a function that is called later) must not use functions or `let`/`const`/`class`
  declarations from a file that is loaded later - function declarations are only hoisted within their own file;
- a stylesheet whose sections are far apart is applied as a whole at its first position, which matters if its later rules
  compete with rules in between.
If something only misbehaves in the runnable copy, that is the cause; `npm run dev` always runs the original order.

Note that removing the indentation also shifts the indentation of multi-line template strings, so markup that the
scripts generate at runtime can differ in whitespace in the split copy. The joined `index.html` is always byte-identical.

Thanks to @ehoogeveen-medweb for contributing this tool.
