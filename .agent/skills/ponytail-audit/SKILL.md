---
name: ponytail-audit
description: >-
  Audit the entire repository for bloat, unnecessary abstractions, duplicate utilities, dead code, and over-engineering, ranked with the highest impact cleanups first.
license: MIT
---

# Ponytail Audit

Run a comprehensive repository audit focused on eliminating complexity, dead code, and over-engineering across the codebase.

---

## Audit Workflow

1. **Map the Architecture**:
   - Trace entry points (HTTP routes, CLI, background workers, event consumers).
   - Follow how data moves from inbound requests down to persistence.
   - Note installed dependencies in `package.json` vs. what is actually imported.
2. **Find Bloat & Over-Engineering**:
   - Duplicate utility functions across modules.
   - Unused abstractions, multi-layered wrappers where a single function suffices.
   - Heavy dependencies imported for minor tasks that standard library or simple functions can do.
   - Dead or commented-out code.
3. **Verify Boundary Hardening**:
   - Ensure central validation layers (Zod schemas) are not bypassed.
   - Check authorization guards on all exposed routes.
   - Verify transaction boundaries on multi-table updates.
4. **Rank Findings by Impact**:
   - Order recommendations by the amount of code eliminated and maintenance burden reduced.

---

## Audit Report Format

### 1. Executive Summary
- Total files inspected, overall architecture health score.
- Estimated lines of code that can be safely eliminated.

### 2. High-Impact Cleanups (Top Priority)
For each top offender:
- **Target**: File/module or dependency.
- **Problem**: Description of unnecessary complexity or bloat.
- **Proposed Solution**: Simplified native or existing alternative.
- **Lines Saved**: Estimated reduction.

### 3. Duplicate & Redundant Utilities
List helpers or patterns implemented in multiple places that should be consolidated into one or replaced with standard language features.

### 4. Dependency Trimming
Identify packages that can be uninstalled in favor of native platform features or existing libraries.
