const bcrypt = require('bcryptjs');

/**
 * One demo account per role so the mobile login screen can be exercised
 * without registering by hand. Upserted on `phone`, so re-running the seed is
 * safe and a changed password or email is picked up.
 *
 * These accounts exist for the seeded demo environment only — never run the
 * seed against a real deployment.
 */
const DEMO_PASSWORD = 'password123';

const DEMO_USERS = [
  {
    name: 'Park Manager (Demo)',
    phone: '+94770000001',
    email: 'manager@wildlife.demo',
    role: 'manager'
  },
  {
    name: 'Operations Officer (Demo)',
    phone: '+94770000002',
    email: 'officer@wildlife.demo',
    role: 'officer'
  },
  {
    name: 'Ranger (Demo)',
    phone: '+94770000003',
    email: 'ranger@wildlife.demo',
    role: 'ranger'
  },
  {
    name: 'Villager (Demo)',
    phone: '+94770000004',
    email: 'villager@wildlife.demo',
    role: 'villager'
  }
];

// Passwords are hashed once, not once per user.
async function hashDemoUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return DEMO_USERS.map((user) => ({ ...user, passwordHash }));
}

module.exports = { DEMO_PASSWORD, DEMO_USERS, hashDemoUsers };