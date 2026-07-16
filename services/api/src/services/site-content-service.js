const { getSiteContentRepository } = require('../repositories/site-content-repository');
const { DEFAULT_LANDING } = require('../db/migrate-site-content');

const LANDING_KEY = 'landing';

function normalizeFeature(item, index) {
  return {
    icon: String(item?.icon || '✓').trim().slice(0, 8),
    title: String(item?.title || `Recurso ${index + 1}`).trim().slice(0, 120),
    description: String(item?.description || '').trim().slice(0, 500),
  };
}

function normalizeLandingContent(input = {}) {
  const features = Array.isArray(input.features)
    ? input.features.map(normalizeFeature).filter((f) => f.title)
    : DEFAULT_LANDING.features;

  return {
    enabled: input.enabled !== false && input.enabled !== 'false',
    brand_icon: String(input.brand_icon ?? DEFAULT_LANDING.brand_icon).trim().slice(0, 8),
    brand_name: String(input.brand_name ?? DEFAULT_LANDING.brand_name).trim().slice(0, 120),
    hero_title: String(input.hero_title ?? DEFAULT_LANDING.hero_title).trim().slice(0, 200),
    hero_subtitle: String(input.hero_subtitle ?? DEFAULT_LANDING.hero_subtitle).trim().slice(0, 500),
    hero_cta_primary_label: String(input.hero_cta_primary_label ?? DEFAULT_LANDING.hero_cta_primary_label).trim().slice(0, 60),
    hero_cta_primary_url: String(input.hero_cta_primary_url ?? DEFAULT_LANDING.hero_cta_primary_url).trim().slice(0, 200),
    hero_cta_secondary_label: String(input.hero_cta_secondary_label ?? DEFAULT_LANDING.hero_cta_secondary_label).trim().slice(0, 60),
    hero_cta_secondary_url: String(input.hero_cta_secondary_url ?? DEFAULT_LANDING.hero_cta_secondary_url).trim().slice(0, 200),
    features_title: String(input.features_title ?? DEFAULT_LANDING.features_title).trim().slice(0, 120),
    features: features.length ? features : DEFAULT_LANDING.features,
    plans_section_enabled: input.plans_section_enabled !== false && input.plans_section_enabled !== 'false',
    plans_section_title: String(input.plans_section_title ?? DEFAULT_LANDING.plans_section_title).trim().slice(0, 120),
    plans_section_subtitle: String(input.plans_section_subtitle ?? DEFAULT_LANDING.plans_section_subtitle).trim().slice(0, 300),
    contact_title: String(input.contact_title ?? DEFAULT_LANDING.contact_title).trim().slice(0, 80),
    contact_phone: String(input.contact_phone ?? '').trim().slice(0, 30),
    contact_whatsapp: String(input.contact_whatsapp ?? '').trim().slice(0, 30),
    contact_email: String(input.contact_email ?? '').trim().slice(0, 120),
    footer_text: String(input.footer_text ?? DEFAULT_LANDING.footer_text).trim().slice(0, 300),
    meta_description: String(input.meta_description ?? DEFAULT_LANDING.meta_description).trim().slice(0, 300),
  };
}

function formatRow(row) {
  if (!row) {
    return {
      key: LANDING_KEY,
      content: normalizeLandingContent(DEFAULT_LANDING),
      updated_at: null,
      updated_by: null,
    };
  }
  return {
    key: row.key,
    content: normalizeLandingContent(row.content),
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

class SiteContentService {
  constructor() {
    this.repo = getSiteContentRepository();
  }

  async getLanding() {
    const row = await this.repo.get(LANDING_KEY);
    return formatRow(row);
  }

  async updateLanding(content, updatedBy = null) {
    const normalized = normalizeLandingContent(content);
    const row = await this.repo.upsert(LANDING_KEY, normalized, updatedBy);
    return formatRow(row);
  }
}

let instance = null;

function getSiteContentService() {
  if (!instance) instance = new SiteContentService();
  return instance;
}

module.exports = {
  SiteContentService,
  getSiteContentService,
  normalizeLandingContent,
  LANDING_KEY,
};
