/**
 * Rooftop Site Surveys & Engineering BOM Database Repository
 * Powered by Prisma ORM (@prisma/client)
 */

import { prisma } from '../../database/index.js';

export const surveyRepository = {
  /**
   * Generates sequential survey identifier: SRV-YYYY-XXXXX
   */
  async getNextSurveyNumber(tx = null) {
    const client = tx || prisma;
    const year = new Date().getFullYear();
    const result = await client.$queryRaw`SELECT nextval('survey_number_seq') as seq`;
    const seq = Number(result[0].seq);
    return `SRV-${year}-${String(seq).padStart(5, '0')}`;
  },

  /**
   * Generates sequential BOM identifier: BOM-YYYY-XXXXX
   */
  async getNextBomNumber(tx = null) {
    const client = tx || prisma;
    const year = new Date().getFullYear();
    const result = await client.$queryRaw`SELECT nextval('bom_number_seq') as seq`;
    const seq = Number(result[0].seq);
    return `BOM-${year}-${String(seq).padStart(5, '0')}`;
  },

  /**
   * Creates a new site survey
   */
  async createSurvey(data, tx = null) {
    const client = tx || prisma;
    return client.surveys.create({
      data,
      include: {
        users_surveys_assigned_engineer_idTousers: {
          select: { id: true, full_name: true, email: true, phone_e164: true }
        },
        leads: {
          select: { id: true, lead_number: true, full_name: true, phone_e164: true, stage: true }
        },
        customers: {
          select: { id: true, customer_code: true, full_name: true, phone_e164: true }
        }
      }
    });
  },

  /**
   * Finds survey by ID with relations
   */
  async findSurveyById(id, tx = null) {
    const client = tx || prisma;
    const survey = await client.surveys.findFirst({
      where: { id, deleted_at: null },
      include: {
        users_surveys_assigned_engineer_idTousers: {
          select: { id: true, full_name: true, email: true, phone_e164: true }
        },
        users_surveys_reviewed_byTousers: {
          select: { id: true, full_name: true, email: true }
        },
        leads: {
          select: { id: true, lead_number: true, full_name: true, phone_e164: true, stage: true, site_address: true, city: true, pincode: true }
        },
        customers: {
          select: { id: true, customer_code: true, full_name: true, phone_e164: true }
        },
        survey_photos: {
          orderBy: { created_at: 'desc' }
        },
        project_boms: {
          orderBy: [
            { created_at: 'desc' },
            { version: 'desc' }
          ],
          include: {
            bom_validations: true,
            project_bom_items: {
              include: {
                products: {
                  select: { id: true, sku: true, brand: true, model_name: true, unit_code: true }
                }
              }
            }
          }
        }
      }
    });

    if (!survey) return null;

    const {
      users_surveys_assigned_engineer_idTousers: engineer,
      users_surveys_reviewed_byTousers: reviewer,
      ...rest
    } = survey;

    return {
      ...rest,
      engineer,
      reviewer
    };
  },

  /**
   * Lists surveys with pagination & filters
   */
  async listSurveys({ page = 1, limit = 20, status, assigned_engineer_id, lead_id, customer_id, search }, tx = null) {
    const client = tx || prisma;
    const where = {
      deleted_at: null
    };

    if (status) where.status = status;
    if (assigned_engineer_id) where.assigned_engineer_id = assigned_engineer_id;
    if (lead_id) where.lead_id = lead_id;
    if (customer_id) where.customer_id = customer_id;

    if (search) {
      where.OR = [
        { survey_number: { contains: search, mode: 'insensitive' } },
        { discom_provider: { contains: search, mode: 'insensitive' } },
        { consumer_number: { contains: search, mode: 'insensitive' } },
        { leads: { full_name: { contains: search, mode: 'insensitive' } } },
        { leads: { phone_e164: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [rows, total] = await Promise.all([
      client.surveys.findMany({
        where,
        include: {
          users_surveys_assigned_engineer_idTousers: {
            select: { id: true, full_name: true, email: true }
          },
          leads: {
            select: { id: true, lead_number: true, full_name: true, phone_e164: true, stage: true }
          },
          customers: {
            select: { id: true, customer_code: true, full_name: true }
          },
          _count: {
            select: { survey_photos: true, project_boms: true }
          }
        },
        orderBy: { scheduled_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      client.surveys.count({ where })
    ]);

    const surveys = rows.map((s) => {
      const {
        users_surveys_assigned_engineer_idTousers: engineer,
        _count,
        ...rest
      } = s;
      return {
        ...rest,
        engineer,
        photos_count: _count.survey_photos,
        boms_count: _count.project_boms
      };
    });

    return {
      surveys,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  /**
   * Updates survey data
   */
  async updateSurvey(id, data, tx = null) {
    const client = tx || prisma;
    return client.surveys.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date()
      }
    });
  },

  /**
   * Adds a photo to a survey
   */
  async addPhoto(data, tx = null) {
    const client = tx || prisma;
    return client.survey_photos.create({
      data
    });
  },

  /**
   * Lists photos for a survey
   */
  async listPhotos(surveyId, tx = null) {
    const client = tx || prisma;
    return client.survey_photos.findMany({
      where: { survey_id: surveyId },
      orderBy: { created_at: 'desc' }
    });
  },

  /**
   * Creates a versioned Project BOM with items in a transaction
   */
  async createBom(bomData, itemsData, tx = null) {
    const client = tx || prisma;

    const bom = await client.project_boms.create({
      data: {
        ...bomData,
        project_bom_items: {
          create: itemsData
        }
      },
      include: {
        project_bom_items: {
          include: {
            products: {
              select: { id: true, sku: true, brand: true, model_name: true, unit_code: true }
            }
          }
        }
      }
    });

    return bom;
  },

  /**
   * Finds BOM by ID with items and products
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
                product_categories: true
              }
            }
          }
        },
        surveys: {
          select: { id: true, survey_number: true, proposed_capacity_kw: true, roof_type: true }
        },
        leads: {
          select: { id: true, lead_number: true, full_name: true }
        }
      }
    });
  }
};
