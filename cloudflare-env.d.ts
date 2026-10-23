declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CONTACT_CENTER_URL?: string;
    CONTACT_CENTER_TOKEN?: string;
    CRM_INTAKE_SECRET?: string;
    BUCKET?: R2Bucket;
  }
}
