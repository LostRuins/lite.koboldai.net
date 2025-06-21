## These are scripts to split and join the main html for easier editing

To run them:
1. Run `npm install` to install the `html-lexer` dependency (which itself is dependency free)
2. Run `npm run split` or `npm run split index.html` to generate the split files from the monolithic HTML
3. The split files are placed in directory `split` (subdirectory `index` for `index.html`) and are untracked
4. Run `npm run join` or `npm run join index.html` to turn the split files back into the monolithic HTML, replacing the original file

The `split` script added by this commit works as follows:
1. Parse the input HTML file into a custom parse tree
2. For every `<script>` element with contents:
    1. Get the target filename for the `id` attribute or generate one
    2. Remove extra leading and trailing newlines and indentation
    3. Record the details of the changes in a `data-actions` attribute
    4. Write the embedded JS to the target file
    5. Reference the outlined JS through the `src` attribute
3. For every `<style>` element with contents:
    1. Get the target filename for the `id` attribute or generate one
    2. Remove extra leading and trailing newlines and indentation
    3. Record the details of the changes in a `data-actions` attribute
    4. Write the embedded CSS to the target file
    5. Turn the `<style>` element into a `<link rel="stylesheet">` element
    6. Reference the outlined CSS through the `href` attribute
4. Serialize the updated parse tree and write the HTML file

The `join` script reverses the process, applying the `data-actions` and inlining the JS and CSS (removing the previously added attributes and turning `<link rel="stylesheet">` back into `<style>`).

You can run the generated HTML files in your browser just like the original - all the references work.

Thanks to @ehoogeveen-medweb for contributing this tool.