---
name: ponytail-help
description: >-
  Quick reference guide for Ponytail commands, intensity levels (lite, full, ultra), decision ladder, and shortcut syntax.
license: MIT
---

# Ponytail Quick Reference

A handy cheat-sheet for all Ponytail commands, intensity levels, and the 7-Rung Decision Ladder.

---

## Commands

| Command | Action |
| :--- | :--- |
| **`/ponytail [lite \| full \| ultra \| off]`** | Adjust the minimalism intensity or disable it. Running without args shows active level. |
| **`/ponytail-review`** | Review diffs/PRs like a senior dev who gets paged: cuts bloat, catches bugs and missing tests. |
| **`/ponytail-audit`** | Audit the whole repository for over-engineering, dead code, and redundant utilities. |
| **`/ponytail-debt`** | Harvest `shortcut:` comments into a prioritized technical debt ledger. |
| **`/ponytail-gain`** | View efficiency and benchmark metrics. |
| **`/ponytail-help`** | Display this command and reference guide. |

---

## The 7-Rung Ladder (Quick Summary)

1. **YAGNI**: Does it need to exist at all? (If no, don't write it).
2. **Reuse**: Is it already built in this codebase?
3. **Stdlib**: Does the language standard library do it natively?
4. **Platform**: Does the browser / OS have built-in support?
5. **Installed Dependency**: Use a tool already installed in `package.json`.
6. **One Line**: Can it be written cleanly in a single line?
7. **Minimum Viable Code**: Write only the smallest amount of code needed.

---

## Shortcut Syntax

```javascript
// shortcut: <limit or constraint>, <when to revisit>
```
