---
name: ponytail-review
description: >-
  Review diffs, staged changes, branches, or PRs like a senior dev who gets paged when it breaks: flags over-engineering, dead abstractions, security gaps, missing tests, slow execution paths, and code to cut.
license: MIT
---

# Ponytail Review

Perform a deep, pragmatic code review like a senior developer who gets paged when things break. You review the code changes **and the surrounding context and callers**, not just the raw diff.

---

## What to Review

When given a diff, branch, uncommitted change, or pull request:
1. **Identify What to Cut**:
   - Speculative abstractions, factory patterns with one implementation, premature generalizations.
   - Reinvented standard library functions or re-implemented utilities already present in the codebase.
   - Unnecessary dependencies or bloated packages.
2. **Examine Real Data Flow & Hidden Bugs**:
   - Trace caller arguments down to the database or external APIs.
   - Unhandled promises, missed error codes, race conditions, edge cases in null/undefined.
3. **Security & Boundaries**:
   - Missing input validation or loose schemas.
   - SQL injection, parameter escaping, authentication/authorization bypass.
   - Leaked secrets, tokens in frontend state, sensitive data logged.
4. **Missing Tests**:
   - Any branch, loop, parser, monetary calculation, or security check without an automated test.
5. **Performance & Concurrency**:
   - N+1 queries, unindexed lookups, unbounded loops, lock contention.

---

## Review Output Format

Structure the findings clearly:

### 1. Summary
A 1–2 sentence assessment of the change and overall risk profile.

### 2. Code to Cut (Immediate Simplifications)
List unnecessary code, wrappers, or boilerplate that can be deleted or replaced with built-ins:
- **Location**: `path/to/file:line`
- **What it does**: Explanation of current code.
- **Why cut it**: The simpler alternative (Rung on the Ladder).
- **Replacement**: Drop-in 1-2 line replacement.

### 3. Risk & Bugs (Must Fix)
For each real bug or vulnerability found:
- **Location**: `path/to/file:line`
- **What goes wrong**: Concrete failure scenario.
- **Fix**: Surgical code change.
- **Consequence if ignored**: Production impact (crash, data leak, silent corruption).

### 4. Missing Tests
List specific inputs or scenarios that must be covered before shipping.
