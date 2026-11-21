/**
 * Client-Side Prefix Trie Data Structure
 * Provides instantaneous O(L) prefix search and autocomplete for dropdowns, pickers, and tables.
 */

class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
    this.values = [];
    this.prefixes = [];
  }
}

export class Trie {
  constructor(options = {}) {
    this.root = new TrieNode();
    this.caseSensitive = options.caseSensitive || false;
    this.tokenize = options.tokenize !== undefined ? options.tokenize : true;
    this.maxPrefixCache = options.maxPrefixCache || 25;
    this.itemCount = 0;
  }

  normalize(str) {
    if (str === null || str === undefined) return '';
    const s = String(str).trim();
    return this.caseSensitive ? s : s.toLowerCase();
  }

  extractTokens(text) {
    const norm = this.normalize(text);
    if (!norm) return [];
    return norm.split(/[\s\-_\/]+/).filter(Boolean);
  }

  _insertToken(token, value) {
    if (!token) return;

    let current = this.root;
    for (const char of token) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char);

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

  insert(key, value = null) {
    const norm = this.normalize(key);
    if (!norm) return;

    this._insertToken(norm, value);

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

    if (current.prefixes.length >= limit || current.children.size === 0) {
      return current.prefixes.slice(0, limit);
    }

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

  clear() {
    this.root = new TrieNode();
    this.itemCount = 0;
  }

  size() {
    return this.itemCount;
  }
}
