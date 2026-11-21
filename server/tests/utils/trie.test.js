/**
 * Unit Tests for Prefix Trie (Prefix Tree) Data Structure
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Trie } from '../../src/utils/trie.js';

describe('High-Performance Prefix Trie Data Structure', () => {
  it('instantiates empty Trie correctly', () => {
    const trie = new Trie();
    assert.strictEqual(trie.size(), 0);
    assert.strictEqual(trie.search('any').length, 0);
  });

  it('inserts keys and retrieves exact matches via has()', () => {
    const trie = new Trie();
    trie.insert('PANEL-TOPCON-550W', { sku: 'PANEL-TOPCON-550W', brand: 'Adani' });
    trie.insert('INV-DEYE-5KW', { sku: 'INV-DEYE-5KW', brand: 'Deye' });

    assert.strictEqual(trie.has('PANEL-TOPCON-550W'), true);
    assert.strictEqual(trie.has('panel-topcon-550w'), true); // Case-insensitive
    assert.strictEqual(trie.has('INV-DEYE-5KW'), true);
    assert.strictEqual(trie.has('PANEL-MONO-400W'), false);
  });

  it('performs O(L) prefix search on single words and codes', () => {
    const trie = new Trie();
    const p1 = { id: '1', sku: 'PANEL-550W-ADANI' };
    const p2 = { id: '2', sku: 'PANEL-540W-WAAREE' };
    const p3 = { id: '3', sku: 'INV-5KW-DEYE' };

    trie.insert(p1.sku, p1);
    trie.insert(p2.sku, p2);
    trie.insert(p3.sku, p3);

    const panelResults = trie.search('PANEL');
    assert.strictEqual(panelResults.length, 2);
    assert.deepStrictEqual(panelResults.map(p => p.id).sort(), ['1', '2']);

    const invResults = trie.search('inv-5');
    assert.strictEqual(invResults.length, 1);
    assert.strictEqual(invResults[0].id, '3');

    const emptyResults = trie.search('BATTERY');
    assert.strictEqual(emptyResults.length, 0);
  });

  it('tokenizes multi-word titles and phrases for flexible sub-token lookup', () => {
    const trie = new Trie({ tokenize: true });
    const lead1 = { id: 'L1', name: 'Rajesh Kumar Patel', phone: '+919825012345' };
    const lead2 = { id: 'L2', name: 'Amit Shah Solar Systems', phone: '+919876543210' };

    trie.insert(lead1.name, lead1);
    trie.insert(lead1.phone, lead1);
    trie.insert(lead2.name, lead2);
    trie.insert(lead2.phone, lead2);

    // Search by last name token
    const patelMatches = trie.search('Patel');
    assert.strictEqual(patelMatches.length, 1);
    assert.strictEqual(patelMatches[0].id, 'L1');

    // Search by middle word
    const solarMatches = trie.search('Solar');
    assert.strictEqual(solarMatches.length, 1);
    assert.strictEqual(solarMatches[0].id, 'L2');

    // Search by phone prefix
    const phoneMatches = trie.search('+919825');
    assert.strictEqual(phoneMatches.length, 1);
    assert.strictEqual(phoneMatches[0].id, 'L1');
  });

  it('supports bulkInsert with field extraction', () => {
    const trie = new Trie();
    const catalog = [
      { id: '101', sku: 'CBL-DC-4MM', name: 'Polycab 4sqmm DC Solar Cable' },
      { id: '102', sku: 'CBL-AC-6MM', name: 'Havells 6sqmm 4Core AC Armoured Cable' },
      { id: '103', sku: 'STR-RCC-STANDARD', name: 'Standard HDG RCC Roof Structure' }
    ];

    trie.bulkInsert(catalog, ['sku', 'name']);

    assert.strictEqual(trie.search('cbl-dc').length, 1);
    assert.strictEqual(trie.search('polycab').length, 1);
    assert.strictEqual(trie.search('havells').length, 1);
    assert.strictEqual(trie.search('str').length, 1);
  });

  it('provides autocomplete word suggestions via suggest()', () => {
    const trie = new Trie();
    trie.insert('solar panel', { category: 'PANEL' });
    trie.insert('solar inverter', { category: 'INVERTER' });
    trie.insert('solar structure', { category: 'STRUCTURE' });
    trie.insert('switchgear', { category: 'BOS' });

    const suggestions = trie.suggest('solar', 5);
    assert.ok(suggestions.length >= 3);
    const words = suggestions.map(s => s.word);
    assert.ok(words.includes('solar panel'));
    assert.ok(words.includes('solar inverter'));
    assert.ok(words.includes('solar structure'));
  });

  it('handles clearing and edge cases gracefully', () => {
    const trie = new Trie();
    trie.insert('test', { id: 1 });
    assert.strictEqual(trie.size(), 1);

    trie.clear();
    assert.strictEqual(trie.size(), 0);
    assert.strictEqual(trie.search('test').length, 0);

    // Empty/null search
    assert.deepStrictEqual(trie.search(''), []);
    assert.deepStrictEqual(trie.search(null), []);
    assert.deepStrictEqual(trie.suggest(undefined), []);
  });
});
