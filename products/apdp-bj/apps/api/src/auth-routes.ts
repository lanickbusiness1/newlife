import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool, withTransaction } from './db.js';
import {
  createOpaqueRefreshToken,
  hashRefreshToken,
  verifyPassword,
  type AuthClaims,
} from './security.js';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(10).max(200) });
const refreshSchema = z.object({ refreshToken: z.string().min(40) });

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_CREDENTIAL_FORMAT' });

    const result = await pool.query(
      `select u.id, u.email, u.user_type, u.password_hash, u.is_active, u.locked_until,
              coalesce(array_agg(distinct r.code) filter (where r.code is not null), '{}') roles,
              coalesce(array_agg(distinct p.code) filter (where p.code is not null), '{}') permissions
         from users u
         left join user_roles ur on ur.user_id = u.id
         left join roles r on r.id = ur.role_id
         left join role_permissions rp on rp.role_id = r.id
         left join permissions p on p.id = rp.permission_id
        where lower(u.email) = lower($1)
        group by u.id`,
      [parsed.data.email],
    );
    const user = result.rows[0];
    const locked = user?.locked_until && new Date(user.locked_until) > new Date();
    if (!user || !user.is_active || locked || !user.password_hash || !(await verifyPassword(parsed.data.password, user.password_hash))) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    }

    const claims: AuthClaims = {
      sub: user.id,
      email: user.email,
      actorType: user.user_type,
      roles: user.roles,
      permissions: user.permissions,
    };
    const accessToken = await reply.jwtSign(claims, { expiresIn: '15m' });
    const refresh = createOpaqueRefreshToken();
    await pool.query(
      `insert into refresh_tokens(user_id, token_hash, expires_at, created_by_ip, user_agent)
       values ($1, $2, now() + interval '30 days', $3, $4)`,
      [user.id, refresh.hash, request.ip, request.headers['user-agent'] ?? null],
    );
    await pool.query('update users set last_login_at = now(), failed_login_count = 0 where id = $1', [user.id]);
    return { accessToken, refreshToken: refresh.token, tokenType: 'Bearer', expiresIn: 900 };
  });

  app.post('/v1/auth/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_REFRESH_TOKEN' });
    const tokenHash = hashRefreshToken(parsed.data.refreshToken);

    const session = await withTransaction(async (client) => {
      const result = await client.query(
        `select rt.id token_id, u.id, u.email, u.user_type,
                coalesce(array_agg(distinct r.code) filter (where r.code is not null), '{}') roles,
                coalesce(array_agg(distinct p.code) filter (where p.code is not null), '{}') permissions
           from refresh_tokens rt
           join users u on u.id = rt.user_id and u.is_active
           left join user_roles ur on ur.user_id = u.id
           left join roles r on r.id = ur.role_id
           left join role_permissions rp on rp.role_id = r.id
           left join permissions p on p.id = rp.permission_id
          where rt.token_hash = $1 and rt.revoked_at is null and rt.expires_at > now()
          group by rt.id, u.id`,
        [tokenHash],
      );
      const row = result.rows[0];
      if (!row) return null;
      await client.query('update refresh_tokens set revoked_at = now() where id = $1', [row.token_id]);
      const next = createOpaqueRefreshToken();
      await client.query(
        `insert into refresh_tokens(user_id, token_hash, expires_at, created_by_ip, user_agent)
         values ($1, $2, now() + interval '30 days', $3, $4)`,
        [row.id, next.hash, request.ip, request.headers['user-agent'] ?? null],
      );
      return { row, next };
    });

    if (!session) return reply.code(401).send({ error: 'REFRESH_TOKEN_REJECTED' });
    const claims: AuthClaims = {
      sub: session.row.id,
      email: session.row.email,
      actorType: session.row.user_type,
      roles: session.row.roles,
      permissions: session.row.permissions,
    };
    return {
      accessToken: await reply.jwtSign(claims, { expiresIn: '15m' }),
      refreshToken: session.next.token,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  });

  app.post('/v1/auth/logout', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(204).send();
    await pool.query('update refresh_tokens set revoked_at = now() where token_hash = $1 and revoked_at is null', [hashRefreshToken(parsed.data.refreshToken)]);
    return reply.code(204).send();
  });
}
