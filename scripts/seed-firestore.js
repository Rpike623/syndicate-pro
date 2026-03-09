/**
 * seed-firestore.js — One-time seeder for demo data into Firestore
 * Run: node scripts/seed-firestore.js
 */
const admin = require('firebase-admin');
const serviceAccount = require('/root/.openclaw/secrets/deeltrack-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'deeltrack'
});

const db = admin.firestore();
const ORG_ID = 'deeltrack_demo';

async function seed() {
  const orgRef = db.collection('orgs').doc(ORG_ID);
  
  // Check if already seeded
  const existing = await orgRef.collection('deals').limit(1).get();
  if (!existing.empty) {
    console.log('Firestore already has demo data. Skipping seed.');
    process.exit(0);
  }

  console.log('Seeding demo data into Firestore...');

  // ── Investors ──
  const investors = [
    { id:'di1', firstName:'James', lastName:'Hartwell', email:'j.hartwell@demo.deeltrack.com', phone:'(214) 555-0101', accredStatus:'verified', totalInvested:650000, status:'active' },
    { id:'di2', firstName:'Sarah', lastName:'Chen', email:'s.chen@demo.deeltrack.com', phone:'(713) 555-0202', accredStatus:'verified', totalInvested:1000000, status:'active' },
    { id:'di3', firstName:'Marcus', lastName:'Williams', email:'mwilliams@demo.deeltrack.com', phone:'(512) 555-0303', accredStatus:'verified', totalInvested:250000, status:'active' },
    { id:'di4', firstName:'Priya', lastName:'Patel', email:'ppatel@demo.deeltrack.com', phone:'(469) 555-0404', accredStatus:'verified', totalInvested:1000000, status:'active' },
    { id:'i7', firstName:'Phil', lastName:'Chapman', email:'philip@jchapmancpa.com', phone:'(817) 555-9000', accredStatus:'verified', totalInvested:1075000, status:'active' },
  ];

  for (const inv of investors) {
    await orgRef.collection('investors').doc(inv.id).set(inv);
  }
  console.log(`  ✓ ${investors.length} investors`);

  // ── Deals ──
  const deals = [
    { id:'live_d1', name:'Pecan Hollow Apartments', type:'multifamily', raise:5500000, irr:19.4, equity:2.1, status:'raising', location:'Fort Worth, TX', added:'2026-03-05', units:128, investors:[{investorId:'i7',committed:250000,ownership:4.54,status:'active'}] },
    { id:'d1', name:'Riverside Flats', type:'multifamily', raise:4200000, irr:18.5, equity:1.9, status:'operating', location:'Austin, TX', added:'2025-11-10', units:96, investors:[{investorId:'di1',committed:250000,ownership:5.95,status:'active'},{investorId:'di2',committed:500000,ownership:11.9,status:'active'},{investorId:'di3',committed:250000,ownership:5.95,status:'active'}] },
    { id:'d2', name:'Meridian Industrial', type:'industrial', raise:7500000, irr:21.2, equity:2.1, status:'closed', location:'Dallas, TX', added:'2025-12-01', investors:[{investorId:'di2',committed:500000,ownership:6.67,status:'active'},{investorId:'di4',committed:1000000,ownership:13.33,status:'active'}] },
    { id:'d3', name:'The Hudson Portfolio', type:'multifamily', raise:12000000, irr:16.8, equity:1.7, status:'operating', location:'Houston, TX', added:'2026-01-15', units:248, investors:[{investorId:'di1',committed:400000,ownership:3.33,status:'active'},{investorId:'di2',committed:500000,ownership:4.17,status:'active'}] },
    { id:'d4', name:'Parkview Commons', type:'multifamily', raise:3100000, irr:19.0, equity:1.95, status:'dd', location:'San Antonio, TX', added:'2026-02-01', units:72, investors:[] },
    { id:'d5', name:'Westgate Retail Center', type:'retail', raise:5800000, irr:14.5, equity:1.6, status:'loi', location:'Fort Worth, TX', added:'2026-02-10', investors:[] },
  ];

  for (const deal of deals) {
    await orgRef.collection('deals').doc(deal.id).set(deal);
  }
  console.log(`  ✓ ${deals.length} deals`);

  // ── Distributions ──
  const dists = [
    { id:'dd1', dealId:'d1', dealName:'Riverside Flats', period:'Q4 2025', totalAmount:84000, date:'2026-01-05', recipients:[{investorId:'di1',amount:14875,ownership:5.95},{investorId:'di2',amount:29750,ownership:11.9},{investorId:'di3',amount:14875,ownership:5.95}] },
    { id:'dd2', dealId:'d2', dealName:'Meridian Industrial', period:'Q4 2025', totalAmount:150000, date:'2026-01-08', recipients:[{investorId:'di2',amount:50025,ownership:6.67},{investorId:'di4',amount:99975,ownership:13.33}] },
  ];

  for (const dist of dists) {
    await orgRef.collection('distributions').doc(dist.id).set(dist);
  }
  console.log(`  ✓ ${dists.length} distributions`);

  // ── Settings ──
  await orgRef.collection('settings').doc('main').set({
    firmName: 'Pike Capital Management LLC',
    firmEmail: 'robert@pikecapital.com',
    gpFullName: 'Robert Pike',
    gpTitle: 'Managing Member',
    defPref: '8',
    defPromote: '20',
  });
  console.log('  ✓ settings');

  console.log('\n✅ Demo data seeded into Firestore under org: ' + ORG_ID);
  process.exit(0);
}

seed().catch(e => { console.error('Seed failed:', e); process.exit(1); });
