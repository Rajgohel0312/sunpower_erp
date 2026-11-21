/**
 * BOM Final Engineering Validation & Approval Gate Engine
 * Evaluates whether a BOM revision meets all mandatory technical standards to be marked
 * INSTALLATION_READY or must remain PRELIMINARY with approval blocked.
 */

export const bomValidator = {
  /**
   * Evaluates requirements, mappings, and items against engineering compliance rules
   */
  validateBOM({ requirements, mappingResults, items }) {
    const validations = [];

    // 1. Gather all blockers and warnings from engineering tier
    if (requirements.validationSummary?.blockers?.length > 0) {
      requirements.validationSummary.blockers.forEach(b => {
        validations.push({
          code: b.code,
          severity: 'BLOCKER',
          component: b.component || 'ENGINEERING',
          description: b.description || b.message,
          expected_value: b.expected_value || b.expected || null,
          actual_value: b.actual_value || b.actual || null,
          technical_explanation: b.technical_explanation || null,
          recommended_action: b.recommendation || null
        });
      });
    }

    if (requirements.validationSummary?.warnings?.length > 0) {
      requirements.validationSummary.warnings.forEach(w => {
        validations.push({
          code: w.code,
          severity: 'WARNING',
          component: w.component || 'ENGINEERING',
          description: w.description || w.message,
          expected_value: w.expected_value || null,
          actual_value: w.actual_value || null,
          technical_explanation: w.technical_explanation || null,
          recommended_action: w.recommendation || null
        });
      });
    }

    // 2. Gather mapping blockers
    if (mappingResults.mappingBlockers?.length > 0) {
      mappingResults.mappingBlockers.forEach(mb => {
        validations.push({
          code: mb.code,
          severity: 'BLOCKER',
          component: mb.component,
          description: mb.description,
          expected_value: 'Active Compatible Catalog Product',
          actual_value: 'None Available',
          technical_explanation: 'Catalog search found no active product matching technical specifications.'
        });
      });
    }

    // 3. Completeness check
    if (items.length < 5) {
      validations.push({
        code: 'BOM_ITEMS_INCOMPLETE',
        severity: 'BLOCKER',
        component: 'SYSTEM',
        description: 'BOM does not contain the minimum required core solar system components.',
        expected_value: '>= 5 items',
        actual_value: `${items.length} items`
      });
    }

    const blockers = validations.filter(v => v.severity === 'BLOCKER');
    const isApprovalBlocked = blockers.length > 0;
    const generationMode = isApprovalBlocked ? 'PRELIMINARY' : 'INSTALLATION_READY';

    return {
      isValid: !isApprovalBlocked,
      generationMode,
      isApprovalBlocked,
      validations,
      blockerCount: blockers.length,
      warningCount: validations.filter(v => v.severity === 'WARNING').length
    };
  }
};
