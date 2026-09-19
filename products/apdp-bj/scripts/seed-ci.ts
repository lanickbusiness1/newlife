import { pool, withTransaction } from '../apps/api/src/db.js';
import { hashPassword } from '../apps/api/src/security.js';

const users = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'applicant@ci.apdp.bj',
    displayName: 'Demandeur CI',
    actorType: 'APPLICANT',
    role: 'APPLICANT',
    password: 'Applicant-CI-Password-2026!',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'reception@ci.apdp.bj',
    displayName: 'Réception CI',
    actorType: 'APDP_INTERNAL',
    role: 'RECEPTION_OFFICER',
    password: 'Reception-CI-Password-2026!',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'instructor@ci.apdp.bj',
    displayName: 'Instructeur CI',
    actorType: 'APDP_INTERNAL',
    role: 'INSTRUCTOR',
    password: 'Instructor-CI-Password-2026!',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'supervisor@ci.apdp.bj',
    displayName: 'Superviseur CI',
    actorType: 'APDP_INTERNAL',
    role: 'SUPERVISOR',
    password: 'Supervisor-CI-Password-2026!',
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    email: 'authority@ci.apdp.bj',
    displayName: 'Autorité CI',
    actorType: 'APDP_INTERNAL',
    role: 'DECISION_AUTHORITY',
    password: 'Authority-CI-Password-2026!',
  },
] as const;

await withTransaction(async (client) => {
  for (const user of users) {
    const passwordHash = await hashPassword(user.password);
    await client.query(
      `insert into users(id, email, display_name, user_type, password_hash, is_active)
       values ($1,$2,$3,$4,$5,true)
       on conflict (id) do update
       set email = excluded.email,
           display_name = excluded.display_name,
           user_type = excluded.user_type,
           password_hash = excluded.password_hash,
           is_active = true`,
      [user.id, user.email, user.displayName, user.actorType, passwordHash],
    );
    await client.query(
      `insert into user_roles(user_id, role_id)
       select $1, id from roles where code = $2
       on conflict do nothing`,
      [user.id, user.role],
    );
  }
});

await pool.end();
console.log('APDP BJ CI identities seeded');
