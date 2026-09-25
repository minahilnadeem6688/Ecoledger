/**
 * EcoLedger: first-run data. Creates the activity types, rewards and an admin
 * account if the database is empty, so a fresh install works straight away.
 */
const bcrypt = require('bcryptjs');
const ActivityType = require('../models/ActivityType');
const Reward = require('../models/Reward');
const Student = require('../models/Student');
const { newWalletAddress } = require('./blockchain');

const TYPES = [
  { name: 'Beach Clean-up', points: 30, icon: 'water' },
  { name: 'Tree Plantation', points: 25, icon: 'leaf' },
  { name: 'Recycling', points: 20, icon: 'reload' },
  { name: 'Composting', points: 18, icon: 'flower' },
  { name: 'Clean Transport', points: 15, icon: 'bicycle' },
  { name: 'Water Conservation', points: 12, icon: 'water-outline' },
  { name: 'Energy Saving', points: 10, icon: 'bulb' },
  { name: 'Other', points: 8, icon: 'sparkles' },
];

const REWARDS = [
  { title: 'Free Cafeteria Meal', description: 'One complete meal at the campus cafe.', icon: 'restaurant', pointsRequired: 50, quantity: 40 },
  { title: 'Eco-Friendly T-Shirt', description: 'EcoLedger t-shirt in organic cotton.', icon: 'shirt', pointsRequired: 70, quantity: 25 },
  { title: 'Library Fee Waiver', description: 'Waiver for up to $10 of overdue fines.', icon: 'library', pointsRequired: 100, quantity: 30 },
  { title: 'Campus Parking', description: 'A one-week student parking permit.', icon: 'car', pointsRequired: 150, quantity: 10 },
];

async function seed() {
  for (const t of TYPES) {
    await ActivityType.updateOne({ name: t.name }, { $setOnInsert: t }, { upsert: true });
  }
  if ((await Reward.countDocuments()) === 0) await Reward.insertMany(REWARDS);

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@ecoledger.dev').toLowerCase();
  if (!(await Student.findOne({ role: 'admin' }))) {
    await Student.create({
      name: 'EcoLedger Admin',
      email: adminEmail,
      password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10),
      role: 'admin',
      walletAddress: newWalletAddress(),
    });
    console.log(`Created admin account ${adminEmail} (set ADMIN_EMAIL / ADMIN_PASSWORD in .env to change it).`);
  }
}

module.exports = seed;
