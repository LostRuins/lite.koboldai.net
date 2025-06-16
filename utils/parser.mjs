import { Lexer } from 'html-lexer';

// Elements with no child nodes or end tags.
const VOID_ELEMS = Object.freeze(
	new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']),
);

/** @typedef {[type: string, chunk: string]} Token */

/** @typedef {{ type: 'string'; content: string }} RawString */

/**
 * @param {string} content
 * @returns {RawString}
 */
export function makeString(content) {
	return Object.seal({ type: 'string', content });
}

/**
 * @typedef {{
 *   type: 'attribute';
 *   name: string;
 *   assign: string;
 *   valueStart: string;
 *   valueData: string[];
 *   valueEnd: string;
 *   value: string;
 * }} Attribute
 */

/**
 * @param {string} name
 * @returns {Attribute}
 */
function makeAttributeRaw(name) {
	return Object.seal({
		type: 'attribute',
		name,
		assign: '',
		valueStart: '',
		/** @type {string[]} */
		valueData: [],
		valueEnd: '',
		get value() {
			return this.valueData.join('');
		},
	});
}

/**
 * @param {string} name
 * @param {string} value
 * @returns {Attribute}
 */
export function makeAttribute(name, value) {
	const attr = makeAttributeRaw(name);

	attr.assign = '=';

	value = value.replaceAll('<', '&lt;');
	value = value.replaceAll('>', '&gt;');

	const numApos = value.length - value.replaceAll("'", '').length;
	const numQuot = value.length - value.replaceAll('"', '').length;

	if (numApos < numQuot) {
		attr.valueStart = "'";
		attr.valueData.push(value.replaceAll("'", '&apos;'));
		attr.valueEnd = "'";
	} else {
		attr.valueStart = '"';
		attr.valueData.push(value.replaceAll('"', '&quot;'));
		attr.valueEnd = '"';
	}

	return attr;
}

/**
 * @typedef {{
 *   type: 'element';
 *   startTagStart: string;
 *   startTagName: string;
 *   startTagAttrs: (Attribute | RawString)[];
 *   startTagEnd: string;
 *   children: (Element | RawString)[];
 *   endTagStart: string;
 *   endTagName: string;
 *   endTagAttrs: (Attribute | RawString)[];
 *   endTagEnd: string;
 *   parent: Element | undefined;
 *   tagName: string;
 *   attributes: (Attribute | RawString)[];
 *   addAttr: (attr: Attribute) => void;
 *   removeAttr: (name: string) => void;
 *   innerHTML: string;
 * }} Element
 */

/**
 * @param {string} [startTagStart]
 * @param {Element} [parent]
 * @returns {Element}
 */
export function makeElementRaw(startTagStart = '', parent) {
	return Object.seal({
		type: 'element',
		startTagStart,
		startTagName: '',
		/** @type {(Attribute | RawString)[]} */
		startTagAttrs: [],
		startTagEnd: '',
		/** @type {(Element | RawString)[]} */
		children: [],
		endTagStart: '',
		endTagName: '',
		/** @type {(Attribute | RawString)[]} */
		endTagAttrs: [],
		endTagEnd: '',
		parent, // Note: Only used during parsing.
		get tagName() {
			return this.startTagName;
		},
		/** @param {string} value */
		set tagName(value) {
			this.startTagName = value;
			if (VOID_ELEMS.has(value)) {
				this.children.length = 0;
				this.endTagStart = '';
				this.endTagName = '';
				this.endTagAttrs.length = 0;
				this.endTagEnd = '';
			} else {
				this.endTagStart = '</';
				this.endTagName = value;
				this.endTagEnd = '>';
			}
		},
		get attributes() {
			return this.startTagAttrs;
		},
		/** @param {Attribute} attr */
		addAttr(attr) {
			if (!this.startTagAttrs.length || this.startTagAttrs.at(-1).type == 'attribute') {
				this.startTagAttrs.push(makeString(' '));
			}
			this.startTagAttrs.push(attr);
		},
		/** @param {string} name */
		removeAttr(name) {
			const index = this.startTagAttrs.findIndex(attr => attr.type == 'attribute' && attr.name == name);
			if (index == -1) return;

			if (index == this.startTagAttrs.length - 1) {
				if (this.startTagAttrs[index - 1].type == 'string') {
					this.startTagAttrs.splice(index - 1, 2);
				} else {
					this.startTagAttrs.splice(index, 1);
				}
			} else {
				if (this.startTagAttrs[index - 1].type == 'string' && this.startTagAttrs[index + 1].type == 'string') {
					// Try to keep nonstandard whitespace.
					if (this.startTagAttrs[index - 1].content == ' ' && this.startTagAttrs[index - 1].content != ' ') {
						this.startTagAttrs.splice(index - 1, 2);
					} else {
						this.startTagAttrs.splice(index, 2);
					}
				} else {
					this.startTagAttrs.splice(index, 1);
				}
			}
		},
		get innerHTML() {
			return serializeChildren(this);
		},
		/** @param {string} value */
		set innerHTML(value) {
			const document = parse(value);
			this.children = document.children;
		},
	});
}

/**
 * @param {string} tagName
 * @param {Element} [parent]
 * @returns {Element}
 */
export function makeElement(tagName) {
	const elem = makeElementRaw();

	elem.startTagStart = '<';
	elem.tagName = tagName;
	elem.startTagEnd = '>';

	return elem;
}

/**
 * @typedef {{
 *   state: number;
 *   currentElement: Element;
 *   leavingElement: Element | undefined;
 *   currentAttribute: Attribute | undefined;
 * }} State
 */

const PARSER_STATE_NORMAL = 0b0000; // Default parser state.
const PARSER_STATE_ENTERING = 0b0001; // In opening tag.
const PARSER_STATE_LEAVING = 0b0010; // In closing tag.
const PARSER_STATE_ATTRIBUTE = 0b0100; // Defining an attribute.
const PARSER_STATE_SCRIPT = 0b1000; // Script data state.

/**
 * @param {Token} token
 * @param {State} state
 * @returns {boolean} Whether the token was processed
 */
function parseAttribute([type, chunk], state) {
	switch (type) {
		case 'attributeAssign':
			state.currentAttribute.assign = chunk;
			return true;
		case 'attributeValueStart':
			state.currentAttribute.valueStart = chunk;
			return true;
		case 'attributeValueEnd':
			state.currentAttribute.valueEnd = chunk;
			state.state &= ~PARSER_STATE_ATTRIBUTE;
			return true;
		case 'attributeValueData':
		case 'charRefDecimal':
		case 'charRefHex':
		case 'charRefLegacy':
		case 'charRefNamed':
		case 'newline':
		case 'uncodedAmpersand':
			state.currentAttribute.valueData.push(chunk);
			return true;
		case 'attributeName':
		case 'tagSpace':
		case 'tagEndAutoclose':
		case 'tagEnd':
			state.state &= ~PARSER_STATE_ATTRIBUTE;
			break;
		default:
			throw new Error(`Attribute: Unexpected token type ${type}!`);
	}
	return false;
}

/**
 * Handles the script data state and a bug in the lexer.
 *
 * @param {Token} token
 * @param {State} state
 */
function parseScript([type, chunk], state) {
	if (state.state & PARSER_STATE_LEAVING) {
		if (type != 'tagName') throw new Error(`Leaving script: Unexpected token type ${type}!`);
		if (chunk == 'script') {
			state.leavingElement = state.currentElement;
			state.state &= ~PARSER_STATE_SCRIPT;
		} else {
			// Not a real end tag, see https://github.com/alwinb/html-lexer/issues/2
			state.currentElement.children.push(makeString(state.currentElement.endTagStart), makeString(chunk));
			state.currentElement.endTagStart = '';
			state.state &= ~PARSER_STATE_LEAVING;
		}
	} else {
		if (type == 'endTagStart') {
			state.currentElement.endTagStart = chunk;
			state.state |= PARSER_STATE_LEAVING;
		} else {
			state.currentElement.children.push(makeString(chunk));
		}
	}
}

/**
 * @param {Token} token
 * @param {State} state
 */
function parseGeneral([type, chunk], state) {
	switch (state.state) {
		case PARSER_STATE_ENTERING: {
			switch (type) {
				case 'attributeName':
					state.currentAttribute = makeAttributeRaw(chunk);
					state.currentElement.startTagAttrs.push(state.currentAttribute);
					state.state |= PARSER_STATE_ATTRIBUTE;
					break;
				case 'tagEndAutoclose':
				// Trailing slash is allowed but ignored.
				case 'tagEnd':
					state.currentElement.startTagEnd = chunk;
					if (state.currentElement.startTagName == 'script') {
						state.state = PARSER_STATE_SCRIPT;
					} else {
						state.state = PARSER_STATE_NORMAL;
						if (VOID_ELEMS.has(state.currentElement.startTagName)) {
							state.currentElement = state.currentElement.parent;
						}
					}
					break;
				case 'tagName':
					state.currentElement.startTagName = chunk;
					if (!VOID_ELEMS.has(chunk)) state.currentElement.endTagName = chunk;
					break;
				case 'tagSpace':
					state.currentElement.startTagAttrs.push(makeString(chunk));
					break;
				default:
					throw new Error(`Entering: Unexpected token type ${type}!`);
			}
			break;
		}
		case PARSER_STATE_LEAVING: {
			switch (type) {
				case 'attributeName':
					// Attributes in end tags are allowed but ignored.
					state.currentAttribute = makeAttributeRaw(chunk);
					state.leavingElement.endTagAttrs.push(state.currentAttribute);
					state.state |= PARSER_STATE_ATTRIBUTE;
					break;
				case 'tagEndAutoclose':
				// Trailing slash is allowed but ignored.
				case 'tagEnd': {
					state.leavingElement.endTagEnd = chunk;
					while (state.currentElement != state.leavingElement) {
						state.currentElement.endTagName = ''; // Missing end tag, so clear the name as well.
						state.currentElement = state.currentElement.parent;
					}
					state.currentElement = state.currentElement.parent;
					state.state = PARSER_STATE_NORMAL;
					break;
				}
				case 'tagName':
					if (chunk == state.currentElement.startTagName) {
						state.leavingElement = state.currentElement;
					} else {
						// Handle mismatched closing tag.
						state.leavingElement = state.currentElement.parent;
						while (state.leavingElement) {
							if (state.leavingElement.startTagName == chunk) break;
							state.leavingElement = state.leavingElement.parent;
						}
						if (state.leavingElement) {
							state.leavingElement.endTagStart = state.currentElement.endTagStart;
							state.currentElement.endTagStart = '';
						} else {
							state.currentElement.children.push(
								makeString(state.currentElement.endTagStart),
								makeString(chunk),
							);
							state.currentElement.endTagStart = '';
							state.state = PARSER_STATE_NORMAL;
						}
					}
					break;
				case 'tagSpace':
					state.leavingElement.endTagAttrs.push(makeString(chunk));
					break;
				default:
					throw new Error(`Leaving: Unexpected token type ${type}!`);
			}
			break;
		}
		case PARSER_STATE_NORMAL: {
			switch (type) {
				case 'endTagStart':
					state.currentElement.endTagStart = chunk;
					state.state = PARSER_STATE_LEAVING;
					break;
				case 'startTagStart':
					state.leavingElement = state.currentElement;
					state.currentElement = makeElementRaw(chunk, state.currentElement);
					state.leavingElement.children.push(state.currentElement);
					state.state = PARSER_STATE_ENTERING;
					break;
				default:
					state.currentElement.children.push(makeString(chunk));
			}
			break;
		}
	}
}

/**
 * @param {string} src
 * @returns {Element}
 */
export function parse(src) {
	/** @type {Token[]} */
	const tokens = [];
	const lexer = new Lexer({ write: token => tokens.push(token), end: () => null });
	lexer.write(src);
	lexer.end();

	// Root element.
	const root = makeElementRaw();

	/** @type {State} */
	const state = Object.seal({
		state: PARSER_STATE_NORMAL,
		currentElement: root,
		/** @type {Element | undefined} */
		leavingElement: undefined,
		/** @type {Attribute | undefined} */
		currentAttribute: undefined,
	});

	for (const token of tokens) {
		if (state.state & PARSER_STATE_ATTRIBUTE) {
			if (parseAttribute(token, state)) continue;
		}
		if (state.state & PARSER_STATE_SCRIPT) {
			parseScript(token, state);
		} else {
			parseGeneral(token, state);
		}
	}

	return root;
}

/**
 * @param {Element} elem
 * @returns {string}
 */
function serializeChildren(elem) {
	let children = '';
	for (const child of elem.children) {
		switch (child.type) {
			case 'string':
				children += child.content;
				break;
			case 'element':
				children += serialize(child);
		}
	}
	return children;
}

/**
 * @param {Element} elem
 * @returns {string}
 */
export function serialize(elem) {
	let startAttrs = '';
	for (const attr of elem.startTagAttrs) {
		switch (attr.type) {
			case 'string':
				startAttrs += attr.content;
				break;
			case 'attribute':
				startAttrs += attr.name + attr.assign + attr.valueStart + attr.valueData.join('') + attr.valueEnd;
		}
	}
	const children = serializeChildren(elem);
	let endAttrs = '';
	for (const attr of elem.endTagAttrs) {
		switch (attr.type) {
			case 'string':
				startAttrs += attr.content;
				break;
			case 'attribute':
				startAttrs += attr.name + attr.assign + attr.valueStart + attr.valueData.join('') + attr.valueEnd;
		}
	}
	return (
		elem.startTagStart +
		elem.startTagName +
		startAttrs +
		elem.startTagEnd +
		children +
		elem.endTagStart +
		elem.endTagName +
		endAttrs +
		elem.endTagEnd
	);
}
