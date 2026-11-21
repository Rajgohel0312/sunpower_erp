/**
 * High-Performance Prefix Trie (Prefix Tree) Data Structure
 * Provides O(L) fast prefix search, multi-token indexing, and instant autocomplete.
 * Used for ultra-fast in-memory lookup of products, leads, customers, and catalog items.
 */

class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.values = [];
    this.prefixes = []; // Cached top references for O(L) instant prefix access
  }
}

export class Trie {
  /**
   * @param {object} [options]
   * @param {boolean} [options.caseSensitive=false]
   * @param {boolean} [options.tokenize=true] - Whether to index all individual words in a phrase
   * @param {number} [options.maxPrefixCache=25] - Max cached items per prefix node
   */
  constructor(options = {}) {
    this.root = new TrieNode();
    this.caseSensitive = options.caseSensitive || false;
    this.tokenize = options.tokenize !== undefined ? options.tokenize : true;
    this.maxPrefixCache = options.maxPrefixCache || 25;
    this.itemCount = 0;
  }

  /**
   * Normalizes a string (lowercase, trimmed)
   * @param {string} str
   * @returns {string}
   */
  normalize(str) {
    if (str === null || str === undefined) return '';
    const s = String(str).trim();
    return this.caseSensitive ? s : s.toLowerCase();
  }

  /**
   * Splits text into searchable tokens (e.g. "Adani Solar 540W" -> ["adani", "solar", "540w"])
   * @param {string} text
   * @returns {string[]}
   */
  extractTokens(text) {
    const norm = this.normalize(text);
    if (!norm) return [];
    // Split by spaces, hyphens, underscores, slashes
    return norm.split(/[\s\-_\/]+/).filter(Boolean);
  }

  /**
   * Internal insertion of a single contiguous token
   * @private
   */
  _insertToken(token, value) {
    if (!token) return;

    let current = this.root;
    for (const char of token) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char);

      // Cache reference in prefix cache if not already present
      if (value !== null && value !== undefined && current.prefixes.length < this.maxPrefixCache) {
        const isDuplicate = current.prefixes.some((v) => {
          if (v && value && v.id && value.id) return v.id === value.id;
          return v === value;
        });
        if (!isDuplicate) {
          current.prefixes.push(value);
        }
      }
    }

    current.isEndOfWord = true;
    if (value !== null && value !== undefined) {
      const isDuplicate = current.values.some((v) => {
        if (v && value && v.id && value.id) return v.id === value.id;
        return v === value;
      });
      if (!isDuplicate) {
        current.values.push(value);
      }
    }
  }

  /**
   * Insert a key (or multi-token phrase) with an associated payload record
   * @param {string} key - Word, phrase, phone, or code to index
   * @param {any} [value] - Associated data record or payload
   */
  insert(key, value = null) {
    const norm = this.normalize(key);
    if (!norm) return;

    // 1. Insert full contiguous normalized key
    this._insertToken(norm, value);

    // 2. If tokenization enabled, index each word so sub-words match
    if (this.tokenize) {
      const tokens = this.extractTokens(norm);
      for (const token of tokens) {
        if (token !== norm) {
          this._insertToken(token, value);
        }
      }
    }

    this.itemCount++;
  }

  /**
   * Bulk insert an array of objects
   * @param {Array<object>} items
   * @param {Array<string>|Function} keyExtractor - Field names or function returning search strings
   */
  bulkInsert(items, keyExtractor) {
    if (!Array.isArray(items)) return;

    for (const item of items) {
      if (!item) continue;
      if (typeof keyExtractor === 'function') {
        const keys = keyExtractor(item);
        if (Array.isArray(keys)) {
          keys.forEach((k) => this.insert(k, item));
        } else if (keys) {
          this.insert(keys, item);
        }
      } else if (Array.isArray(keyExtractor)) {
        for (const field of keyExtractor) {
          if (item[field]) {
            this.insert(item[field], item);
          }
        }
      }
    }
  }

  /**
   * Fast prefix search: returns all values matching the prefix in O(L) time
   * @param {string} prefix
   * @param {number} [limit=20]
   * @returns {Array} Matching payload items
   */
  search(prefix, limit = 20) {
    const norm = this.normalize(prefix);
    if (!norm) return [];

    let current = this.root;
    for (const char of norm) {
      if (!current.children.has(char)) {
        return [];
      }
      current = current.children.get(char);
    }

    // If cached prefix results satisfy limit, return directly (instant O(L))
    if (current.prefixes.length >= limit || current.children.size === 0) {
      return current.prefixes.slice(0, limit);
    }

    // Otherwise, collect from subtree
    const results = [];
    const seenIds = new Set();

    const collect = (node) => {
      if (results.length >= limit) return;

      if (node.isEndOfWord && node.values.length > 0) {
        for (const val of node.values) {
          const id = val && val.id ? val.id : val;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            results.push(val);
            if (results.length >= limit) return;
          }
        }
      }

      for (const child of node.children.values()) {
        collect(child);
        if (results.length >= limit) return;
      }
    };

    collect(current);
    return results;
  }

  /**
   * Autocomplete suggestions: returns matching words and their values
   * @param {string} prefix
   * @param {number} [limit=10]
   * @returns {Array<{ word: string, values: Array }>}
   */
  suggest(prefix, limit = 10) {
    const norm = this.normalize(prefix);
    if (!norm) return [];

    let current = this.root;
    for (const char of norm) {
      if (!current.children.has(char)) {
        return [];
      }
      current = current.children.get(char);
    }

    const suggestions = [];

    const collectWords = (node, currentWord) => {
      if (suggestions.length >= limit) return;
      if (node.isEndOfWord) {
        suggestions.push({
          word: currentWord,
          values: node.values
        });
      }
      for (const [char, child] of node.children.entries()) {
        collectWords(child, currentWord + char);
        if (suggestions.length >= limit) return;
      }
    };

    collectWords(current, norm);
    return suggestions;
  }

  /**
   * Checks whether an exact word/key exists
   * @param {string} word
   * @returns {boolean}
   */
  has(word) {
    const norm = this.normalize(word);
    if (!norm) return false;

    let current = this.root;
    for (const char of norm) {
      if (!current.children.has(char)) return false;
      current = current.children.get(char);
    }
    return current.isEndOfWord;
  }

  /**
   * Clears the Trie and resets memory
   */
  clear() {
    this.root = new TrieNode();
    this.itemCount = 0;
  }

  /**
   * Returns total items indexed
   * @returns {number}
   */
  size() {
    return this.itemCount;
  }
}
