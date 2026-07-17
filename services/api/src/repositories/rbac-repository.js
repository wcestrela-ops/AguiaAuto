const { getPool } = require('../db/pool');
const { PERMISSIONS, ROLE_PERMISSIONS } = require('../lib/security/permissions');

class RbacRepository {
  constructor() {
    this.pool = getPool();
  }

  async seedDefaults() {
    for (const permission of PERMISSIONS) {
      await this.pool.query(
        `INSERT INTO permissions (slug, description, category)
         VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET description = EXCLUDED.description, category = EXCLUDED.category`,
        [permission.slug, permission.description, permission.category],
      );
    }

    for (const [roleSlug, permissionSlugs] of Object.entries(ROLE_PERMISSIONS)) {
      const { rows: roleRows } = await this.pool.query(
        `INSERT INTO roles (slug, name, is_system)
         VALUES ($1, $2, true)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [roleSlug, roleSlug],
      );
      const roleId = roleRows[0].id;

      await this.pool.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

      for (const permSlug of permissionSlugs) {
        await this.pool.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT $1, p.id FROM permissions p WHERE p.slug = $2
           ON CONFLICT DO NOTHING`,
          [roleId, permSlug],
        );
      }
    }
  }

  async assignRoleToUser(userId, roleSlug) {
    await this.pool.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, r.id FROM roles r WHERE r.slug = $2
       ON CONFLICT DO NOTHING`,
      [userId, roleSlug],
    );
  }

  async getUserPermissions(userId) {
    const { rows } = await this.pool.query(
      `SELECT DISTINCT p.slug
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1
       UNION
       SELECT DISTINCT p.slug
       FROM users u
       JOIN roles r ON r.slug = u.role
       JOIN role_permissions rp ON rp.role_id = r.id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE u.id = $1`,
      [userId],
    );
    return rows.map((row) => row.slug);
  }

  async userHasPermission(userId, permission) {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  }
}

let instance = null;

function getRbacRepository() {
  if (!instance) instance = new RbacRepository();
  return instance;
}

module.exports = { RbacRepository, getRbacRepository };
