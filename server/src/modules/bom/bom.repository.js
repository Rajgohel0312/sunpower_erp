/**
 * BOM Database Repository
 * Powered by Prisma ORM (@prisma/client)
 */

import { prisma } from '../../database/index.js';

export const bomRepository = {
  /**
   * Generates sequential human-readable BOM number (BOM-2026-00001)
   */
  async getNextBomNumber(tx = null) {
    const client = tx || prisma;
    const year = new Date().getFullYear();
    const result = await client.$queryRaw`SELECT nextval('bom_number_seq') as seq`;
    const seq = Number(result[0].seq);
    return `BOM-${year}-${String(seq).padStart(5, '0')}`;
  },

  /**
   * Finds latest BOM version for a survey
   */
  async findLatestVersion(surveyId, tx = null) {
    const client = tx || prisma;
    const record = await client.project_boms.findFirst({
      where: { survey_id: surveyId },
      orderBy: { version: 'desc' },
      select: { version: true }
    });
    return record?.version || 0;
  },

  /**
   * Marks older DRAFT BOMs as SUPERSEDED for a survey
   */
  async supersedeDraftBoms(surveyId, tx = null) {
    const client = tx || prisma;
    return client.project_boms.updateMany({
      where: {
        survey_id: surveyId,
        status: 'DRAFT'
      },
      data: {
        status: 'SUPERSEDED',
        updated_at: new Date()
      }
    });
  },

  /**
   * Creates a versioned Project BOM with items and atomic validations inside a transaction
   */
  async createBomWithItems(bomData, itemsData, validationsData = [], tx = null) {
    const client = tx || prisma;

    const bom = await client.project_boms.create({
      data: {
        ...bomData,
        project_bom_items: {
          create: itemsData
        },
        bom_validations: {
          create: validationsData
        }
      },
      include: {
        project_bom_items: {
          include: {
            products: {
              select: { id: true, sku: true, brand: true, model_name: true, unit_code: true }
            }
          }
        },
        bom_validations: true
      }
    });

    return bom;
  },

  /**
   * Finds BOM by ID with complete relations, products, and validations
   */
  async findBomById(id, tx = null) {
    const client = tx || prisma;
    return client.project_boms.findUnique({
      where: { id },
      include: {
        project_bom_items: {
          include: {
            products: {
              include: {
                product_categories: true,
                product_specifications: true
              }
            }
          }
        },
        bom_validations: {
          orderBy: { severity: 'asc' }
        },
        surveys: {
          select: {
            id: true,
            survey_number: true,
            proposed_capacity_kw: true,
            shadow_free_area_sqft: true,
            roof_type: true,
            supply_phase: true,
            status: true
          }
        },
        leads: {
          select: { id: true, lead_number: true, full_name: true }
        },
        users_project_boms_created_byTousers: {
          select: { id: true, full_name: true, email: true }
        },
        users_project_boms_approved_byTousers: {
          select: { id: true, full_name: true, email: true }
        }
      }
    });
  },

  /**
   * Lists all historical BOM revisions for a survey
   */
  async listBomsBySurveyId(surveyId, tx = null) {
    const client = tx || prisma;
    return client.project_boms.findMany({
      where: { survey_id: surveyId },
      orderBy: [
        { version: 'desc' },
        { created_at: 'desc' }
      ],
      include: {
        project_bom_items: {
          include: {
            products: {
              select: { id: true, sku: true, brand: true, model_name: true, unit_code: true }
            }
          }
        },
        bom_validations: true
      }
    });
  },

  /**
   * Updates BOM status (e.g. APPROVED or REJECTED)
   */
  async updateStatus(id, status, actorId, tx = null) {
    const client = tx || prisma;
    const data = {
      status,
      updated_at: new Date()
    };
    if (status === 'APPROVED') {
      data.approved_by = actorId;
      data.approved_at = new Date();
    }
    return client.project_boms.update({
      where: { id },
      data
    });
  }
};
