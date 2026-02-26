const admin = require('firebase-admin');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(module => module.default(...args));
(async () => {
  const sa = require('/root/.openclaw/secrets/deeltrack-service-account.json');
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'deeltrack' });
  const db = admin.firestore();
  const auth = admin.auth();
  const results = [];
  const users = await auth.listUsers(100);
  results.push(`Auth users: ${users.users.map(u=>u.email).join(', ')}`);
  const gp = users.users.find(u=>u.email==='gp@deeltrack.com');
  if (!gp) throw new Error('GP user missing');
  results.push(`GP uid ${gp.uid} verified ${gp.emailVerified}`);
  const gpDoc = await db.collection('users').doc(gp.uid).get();
  if (!gpDoc.exists) throw new Error('GP doc missing');
  results.push(`GP doc org ${gpDoc.data().orgId}`);
  const investor = users.users.find(u=>u.email==='philip@jchapmancpa.com');
  const investorDoc = investor ? await db.collection('users').doc(investor.uid).get() : null;
  results.push(`Investor doc org ${(investorDoc?.data()?.orgId)||'missing'}`);
  const deals = await db.collection('orgs').doc('kiqlcx').collection('deals').get();
  results.push(`Deals count ${deals.size}`);
  if (!deals.size) throw new Error('No deals');
  const distrib = await db.collection('orgs').doc('kiqlcx').collection('distributions').get();
  results.push(`Dist count ${distrib.size}`);
  fs.readFileSync('firestore.rules', 'utf8');
  results.push('Rules read ok');
  const key = 'AIzaSyApYFLlP39E8_LGLsSOgzqFbt333U5Yli4';
  const loginRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ email:'gp@deeltrack.com', password:'Demo1234!', returnSecureToken:true })
  });
  const login = await loginRes.json();
  if (!login.idToken) throw new Error('Firebase login failed: ' + JSON.stringify(login));
  results.push('Firebase login for GP succeeded');
  const resp = await fetch('https://us-central1-deeltrack.cloudfunctions.net/sendEmail', {
    method:'POST',
    headers:{
      'Authorization':`Bearer ${login.idToken}`,
      'Content-Type':'application/json'
    },
    body: JSON.stringify({ to:'rpike623@gmail.com', subject:'Smoke test', html:'<p>ok</p>', type:'test' })
  });
  const body = await resp.text();
  results.push(`sendEmail status ${resp.status}`);
  if (resp.status !== 200) results.push(`sendEmail body snippet: ${body.slice(0,200)}`);
  console.log(results.join('\n'));
})();
