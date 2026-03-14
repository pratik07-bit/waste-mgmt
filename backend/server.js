const express = require('express');
const cors    = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const crypto  = require('crypto');

const app  = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use((req, res, next) => {
  const ts = new Date().toLocaleTimeString('en-IN');
  console.log(`[${ts}] ${req.method.padEnd(6)} ${req.path}`);
  next();
});

// ── DB SETUP ───────────────────────────────────────────────────────
const db = new sqlite3.Database(path.join(__dirname, 'waste.db'), err => {
  if (err) { console.error('DB Error:', err); process.exit(1); }
  console.log('✓ Database connected');
});

const run = (sql, p=[]) => new Promise((res,rej) => db.run(sql, p, function(e){ e?rej(e):res(this); }));
const all = (sql, p=[]) => new Promise((res,rej) => db.all(sql, p, (e,r)=>e?rej(e):res(r)));
const get = (sql, p=[]) => new Promise((res,rej) => db.get(sql, p, (e,r)=>e?rej(e):res(r)));

function sanitize(s) { return typeof s==='string' ? s.replace(/[<>"'%;()&+]/g,'').trim().slice(0,500) : s; }
function hashPwd(p)  { return crypto.createHash('sha256').update(p+'wms_salt_pmc').digest('hex'); }

// ── SCHEMA ─────────────────────────────────────────────────────────
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS Zone (
    zone_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_name    TEXT NOT NULL,
    city         TEXT DEFAULT 'Pune',
    area_sqkm    REAL,
    boundary_lat REAL, boundary_lng REAL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS Users (
    user_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT UNIQUE NOT NULL,
    password   TEXT NOT NULL,
    role       TEXT DEFAULT 'admin',
    last_login TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS Citizen (
    citizen_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT NOT NULL,
    phone        TEXT UNIQUE NOT NULL,
    email        TEXT,
    zone_id      INTEGER,
    address      TEXT,
    registered_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zone_id) REFERENCES Zone(zone_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS Bin (
    bin_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id      INTEGER NOT NULL,
    location_lat REAL NOT NULL,
    location_lng REAL NOT NULL,
    address      TEXT,
    bin_type     TEXT DEFAULT 'general',
    capacity_kg  REAL DEFAULT 100,
    fill_level   INTEGER DEFAULT 0,
    status       TEXT DEFAULT 'active',
    last_collected TEXT,
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zone_id) REFERENCES Zone(zone_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS Truck (
    truck_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_no   TEXT UNIQUE NOT NULL,
    driver_name  TEXT NOT NULL,
    driver_phone TEXT,
    zone_id      INTEGER,
    capacity_kg  REAL DEFAULT 2000,
    status       TEXT DEFAULT 'active',
    current_lat  REAL,
    current_lng  REAL,
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zone_id) REFERENCES Zone(zone_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS Collection (
    collection_id INTEGER PRIMARY KEY AUTOINCREMENT,
    bin_id        INTEGER NOT NULL,
    truck_id      INTEGER NOT NULL,
    weight_kg     REAL,
    collected_at  TEXT DEFAULT CURRENT_TIMESTAMP,
    notes         TEXT,
    FOREIGN KEY (bin_id)   REFERENCES Bin(bin_id),
    FOREIGN KEY (truck_id) REFERENCES Truck(truck_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS Complaint (
    complaint_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    citizen_name  TEXT NOT NULL,
    phone         TEXT,
    zone_id       INTEGER,
    complaint_type TEXT,
    description   TEXT,
    location_lat  REAL,
    location_lng  REAL,
    image_data    TEXT,
    status        TEXT DEFAULT 'pending',
    admin_notes   TEXT,
    created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
    resolved_at   TEXT,
    FOREIGN KEY (zone_id) REFERENCES Zone(zone_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS Schedule (
    schedule_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    truck_id     INTEGER NOT NULL,
    zone_id      INTEGER NOT NULL,
    pickup_day   TEXT NOT NULL,
    pickup_time  TEXT NOT NULL,
    FOREIGN KEY (truck_id) REFERENCES Truck(truck_id),
    FOREIGN KEY (zone_id)  REFERENCES Zone(zone_id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS Notification (
    notif_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL,
    title      TEXT NOT NULL,
    message    TEXT,
    is_read    INTEGER DEFAULT 0,
    ref_id     INTEGER,
    ref_type   TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed
  db.get('SELECT COUNT(*) as c FROM Zone', (e,r) => {
    if (r?.c > 0) return;
    console.log('Seeding data...');
    db.serialize(() => {
      db.run(`INSERT INTO Zone(zone_name,area_sqkm,boundary_lat,boundary_lng) VALUES
        ('Shivajinagar',12.5,18.5308,73.8475),
        ('Kothrud',18.2,18.5074,73.8065),
        ('Hadapsar',22.0,18.5120,73.9295),
        ('Deccan',9.8,18.5195,73.8553),
        ('Aundh',14.3,18.5589,73.8078)`);

      db.run(`INSERT INTO Users(name,email,password,role) VALUES
        ('PMC Administrator','admin@pmc.gov.in','${hashPwd('admin123')}','admin'),
        ('Zone Officer','officer@pmc.gov.in','${hashPwd('officer123')}','officer')`);

      db.run(`INSERT INTO Citizen(name,phone,email,zone_id,address) VALUES
        ('Priya Sharma','9900011111','priya@mail.com',1,'FC Road, Shivajinagar'),
        ('Amit Kulkarni','9900022222','amit@mail.com',2,'Paud Road, Kothrud'),
        ('Sneha Joshi','9900033333','sneha@mail.com',1,'JM Road, Shivajinagar'),
        ('Rahul Mehta','9900044444','rahul@mail.com',3,'Hadapsar Main Road'),
        ('Kavita Patil','9900055555','kavita@mail.com',4,'Deccan Gymkhana'),
        ('Sunil Desai','9900066666',NULL,5,'Aundh Road'),
        ('Meera Nair','9900077777','meera@mail.com',2,'Karve Road, Kothrud'),
        ('Rohan Wagh','9900088888',NULL,3,'Magarpatta City'),
        ('Anita Gore','9900099999','anita@mail.com',1,'Shivajinagar East'),
        ('Vijay Salve','9901100000','vijay@mail.com',4,'Tilak Road, Deccan')`);

      db.run(`INSERT INTO Truck(vehicle_no,driver_name,driver_phone,zone_id,status,current_lat,current_lng) VALUES
        ('MH12AB1234','Ramesh Patil','9876543210',1,'active',18.5302,73.8470),
        ('MH12CD5678','Suresh Yadav','9876543211',2,'active',18.5080,73.8062),
        ('MH12EF9012','Anita Desai','9876543212',3,'active',18.5125,73.9300),
        ('MH12GH3456','Ravi Shinde','9876543213',4,'idle',18.5200,73.8550),
        ('MH12IJ7890','Deepa Kadam','9876543214',5,'active',18.5590,73.8082)`);

      db.run(`INSERT INTO Bin(zone_id,location_lat,location_lng,address,bin_type,fill_level,last_collected) VALUES
        (1,18.5300,73.8478,'FC Road Junction','general',75,'2025-03-10 07:30'),
        (1,18.5312,73.8485,'PMC Office Gate','recyclable',40,'2025-03-11 08:00'),
        (2,18.5080,73.8065,'Paud Road Market','organic',90,'2025-03-09 06:30'),
        (3,18.5120,73.9300,'Hadapsar Bus Stand','general',20,'2025-03-12 07:00'),
        (2,18.5095,73.8100,'Kothrud Depot','hazardous',55,'2025-03-10 09:00'),
        (3,18.5140,73.9350,'Magarpatta Gate','recyclable',65,'2025-03-11 07:30'),
        (4,18.5195,73.8553,'Deccan Stop','general',85,'2025-03-09 08:00'),
        (5,18.5589,73.8078,'Aundh IT Park','recyclable',30,'2025-03-12 06:30'),
        (1,18.5285,73.8460,'Balgandharva','organic',10,'2025-03-12 09:00'),
        (4,18.5210,73.8570,'Tilak Road','general',95,'2025-03-08 07:00'),
        (5,18.5600,73.8090,'Sus Road','hazardous',60,'2025-03-11 08:30'),
        (2,18.5060,73.8050,'Warje Junction','organic',45,'2025-03-10 07:00')`);

      db.run(`INSERT INTO Collection(bin_id,truck_id,weight_kg,collected_at) VALUES
        (1,1,45.5,'2025-03-10 07:30'),(2,1,30.0,'2025-03-11 08:00'),
        (3,2,52.3,'2025-03-09 06:30'),(4,3,18.7,'2025-03-12 07:00'),
        (5,2,22.0,'2025-03-10 09:00'),(6,3,35.5,'2025-03-11 07:30'),
        (7,4,48.0,'2025-03-09 08:00'),(8,5,15.0,'2025-03-12 06:30'),
        (1,1,40.2,'2025-03-13 07:30'),(9,1,8.5,'2025-03-12 09:00'),
        (10,4,62.0,'2025-03-08 07:00'),(11,5,28.0,'2025-03-11 08:30')`);

      db.run(`INSERT INTO Schedule(truck_id,zone_id,pickup_day,pickup_time) VALUES
        (1,1,'Mon','07:00'),(1,1,'Thu','07:00'),
        (2,2,'Tue','08:00'),(2,2,'Fri','08:00'),
        (3,3,'Wed','06:30'),(3,3,'Sat','06:30'),
        (4,4,'Mon','09:00'),(4,4,'Thu','09:00'),
        (5,5,'Tue','06:30'),(5,5,'Fri','06:30')`);

      db.run(`INSERT INTO Complaint(citizen_name,phone,zone_id,complaint_type,description,status,location_lat,location_lng) VALUES
        ('Priya Sharma','9900011111',1,'overflow','Bin overflowing near market','pending',18.5300,73.8478),
        ('Amit Kulkarni','9900022222',2,'not_collected','Organic bin not collected 3 days','in_progress',18.5080,73.8065),
        ('Sneha Joshi','9900033333',1,'damaged','Recyclable bin is cracked','resolved',18.5312,73.8485),
        ('Rahul Mehta','9900044444',3,'smell','Bad smell from general bin','pending',18.5120,73.9300),
        ('Kavita Patil','9900055555',4,'overflow','Deccan bin 95% full','pending',18.5195,73.8553)`);

      db.run(`INSERT INTO Notification(type,title,message,ref_type,ref_id) VALUES
        ('alert','Bin Critical','Bin #10 at Tilak Road is 95% full','bin',10),
        ('alert','Bin Critical','Bin #3 at Paud Road is 90% full','bin',3),
        ('complaint','New Complaint','Complaint filed by Priya Sharma','complaint',1),
        ('info','Schedule Today','3 pickups scheduled today','schedule',NULL)`);
    });
  });
});

// ── MIDDLEWARE ─────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const [userId, hash] = (token||'').split(':');
  const expected = crypto.createHash('sha256').update(userId+'pmc_session_key').digest('hex').slice(0,16);
  if (hash !== expected) return res.status(401).json({ error: 'Invalid token' });
  req.userId = parseInt(userId);
  next();
}

// ── AUTH ──────────────────────────────────────────────────────────
app.post('/api/login', async (req,res) => {
  try {
    const { email, password } = req.body;
    if (!email||!password) return res.status(400).json({ error:'Email and password required' });
    const user = await get('SELECT * FROM Users WHERE email=? AND password=?', [sanitize(email), hashPwd(password)]);
    if (!user) return res.status(401).json({ error:'Invalid email or password' });
    await run('UPDATE Users SET last_login=CURRENT_TIMESTAMP WHERE user_id=?', [user.user_id]);
    const token = user.user_id+':'+crypto.createHash('sha256').update(user.user_id+'pmc_session_key').digest('hex').slice(0,16);
    const { password:_, ...safe } = user;
    res.json({ token, user: safe });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── DASHBOARD ─────────────────────────────────────────────────────
app.get('/api/dashboard', async (req,res) => {
  try {
    const totalBins        = (await get('SELECT COUNT(*) c FROM Bin')).c;
    const fullBins         = (await get('SELECT COUNT(*) c FROM Bin WHERE fill_level>80')).c;
    const activeTrucks     = (await get("SELECT COUNT(*) c FROM Truck WHERE status='active'")).c;
    const totalCitizens    = (await get('SELECT COUNT(*) c FROM Citizen')).c;
    const complaintsToday  = (await get("SELECT COUNT(*) c FROM Complaint WHERE DATE(created_at)=DATE('now')")).c;
    const wasteToday       = (await get("SELECT ROUND(COALESCE(SUM(weight_kg),0),1) w FROM Collection WHERE DATE(collected_at)=DATE('now')")).w;
    const pendingComplaints= (await get("SELECT COUNT(*) c FROM Complaint WHERE status='pending'")).c;
    const totalWaste       = (await get("SELECT ROUND(COALESCE(SUM(weight_kg),0),1) w FROM Collection")).w;
    const unreadNotifs     = (await get('SELECT COUNT(*) c FROM Notification WHERE is_read=0')).c;

    const wasteByZone = await all(`
      SELECT z.zone_name, ROUND(COALESCE(SUM(c.weight_kg),0),1) AS total
      FROM Zone z LEFT JOIN Bin b ON b.zone_id=z.zone_id
      LEFT JOIN Collection c ON c.bin_id=b.bin_id
      GROUP BY z.zone_id ORDER BY total DESC`);

    const dailyWaste = await all(`
      SELECT DATE(collected_at) AS date, ROUND(SUM(weight_kg),1) AS total
      FROM Collection WHERE collected_at >= DATE('now','-13 days')
      GROUP BY DATE(collected_at) ORDER BY date`);

    const complaintsByZone = await all(`
      SELECT z.zone_name, COUNT(cp.complaint_id) AS total
      FROM Zone z LEFT JOIN Complaint cp ON cp.zone_id=z.zone_id
      GROUP BY z.zone_id ORDER BY total DESC`);

    const complaintsByStatus = await all(`
      SELECT status, COUNT(*) AS total FROM Complaint GROUP BY status`);

    res.json({ totalBins,fullBins,activeTrucks,totalCitizens,complaintsToday,wasteToday,pendingComplaints,totalWaste,unreadNotifs,wasteByZone,dailyWaste,complaintsByZone,complaintsByStatus });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── ZONES ─────────────────────────────────────────────────────────
app.get('/api/zones', async (req,res) => {
  try { res.json(await all('SELECT * FROM Zone ORDER BY zone_name')); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

// ── CITIZENS ──────────────────────────────────────────────────────
app.get('/api/citizens', async (req,res) => {
  try {
    const { search='', zone_id='', sort='registered_at', order='desc', page=1, limit=10 } = req.query;
    let sql='SELECT ct.*,z.zone_name FROM Citizen ct LEFT JOIN Zone z ON ct.zone_id=z.zone_id WHERE 1=1';
    const p=[];
    if (search) { sql+=' AND (ct.name LIKE ? OR ct.phone LIKE ?)'; p.push(`%${search}%`,`%${search}%`); }
    if (zone_id) { sql+=' AND ct.zone_id=?'; p.push(zone_id); }
    const cols={name:'ct.name',zone_name:'z.zone_name',registered_at:'ct.registered_at'};
    sql+=` ORDER BY ${cols[sort]||'ct.registered_at'} ${order==='asc'?'ASC':'DESC'}`;
    const allRows=await all(sql,p); const total=allRows.length;
    const offset=(parseInt(page)-1)*parseInt(limit);
    res.json({ data:allRows.slice(offset,offset+parseInt(limit)), total, page:parseInt(page), pages:Math.ceil(total/parseInt(limit)) });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.get('/api/citizens/stats', async (req,res) => {
  try {
    const total  = (await get('SELECT COUNT(*) c FROM Citizen')).c;
    const today  = (await get("SELECT COUNT(*) c FROM Citizen WHERE DATE(registered_at)=DATE('now')")).c;
    const byZone = await all('SELECT z.zone_name,COUNT(ct.citizen_id) cnt FROM Zone z LEFT JOIN Citizen ct ON ct.zone_id=z.zone_id GROUP BY z.zone_id');
    const daily  = await all("SELECT DATE(registered_at) d,COUNT(*) cnt FROM Citizen WHERE registered_at>=DATE('now','-6 days') GROUP BY d ORDER BY d");
    res.json({ total,today,byZone,daily });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/citizens', async (req,res) => {
  try {
    let { name,phone,email,zone_id,address } = req.body;
    name=sanitize(name); phone=sanitize(phone); email=sanitize(email||''); address=sanitize(address||'');
    if (!name||!phone||!zone_id) return res.status(400).json({ error:'Name, phone and zone required' });
    if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error:'Phone must be 10 digits' });
    if (email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error:'Invalid email' });
    if (await get('SELECT citizen_id FROM Citizen WHERE phone=?',[phone])) return res.status(409).json({ error:'Phone already registered' });
    const r=await run('INSERT INTO Citizen(name,phone,email,zone_id,address) VALUES(?,?,?,?,?)',[name,phone,email||null,zone_id,address||null]);
    await run("INSERT INTO Notification(type,title,message,ref_type,ref_id) VALUES('info','New Citizen',?,?,?)",[`${name} registered`,'citizen',r.lastID]);
    res.json({ citizen_id:r.lastID, message:'Citizen registered' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.put('/api/citizens/:id', async (req,res) => {
  try {
    let { name,phone,email,zone_id,address } = req.body;
    name=sanitize(name); phone=sanitize(phone); email=sanitize(email||''); address=sanitize(address||'');
    if (!name||!phone||!zone_id) return res.status(400).json({ error:'Name, phone and zone required' });
    if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error:'Phone must be 10 digits' });
    const dup=await get('SELECT citizen_id FROM Citizen WHERE phone=? AND citizen_id!=?',[phone,req.params.id]);
    if (dup) return res.status(409).json({ error:'Phone already in use' });
    await run('UPDATE Citizen SET name=?,phone=?,email=?,zone_id=?,address=? WHERE citizen_id=?',[name,phone,email||null,zone_id,address||null,req.params.id]);
    res.json({ message:'Updated' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.delete('/api/citizens/:id', async (req,res) => {
  try { await run('DELETE FROM Citizen WHERE citizen_id=?',[req.params.id]); res.json({ message:'Deleted' }); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

// ── BINS ──────────────────────────────────────────────────────────
app.get('/api/bins', async (req,res) => {
  try {
    const rows=await all('SELECT b.*,z.zone_name FROM Bin b JOIN Zone z ON b.zone_id=z.zone_id ORDER BY b.fill_level DESC');
    res.json(rows);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/bins', async (req,res) => {
  try {
    const { zone_id,location_lat,location_lng,address,bin_type,capacity_kg } = req.body;
    const r=await run('INSERT INTO Bin(zone_id,location_lat,location_lng,address,bin_type,capacity_kg) VALUES(?,?,?,?,?,?)',
      [zone_id,location_lat,location_lng,sanitize(address||''),bin_type||'general',capacity_kg||100]);
    if ((await get('SELECT fill_level FROM Bin WHERE bin_id=?',[r.lastID])).fill_level>80)
      await run("INSERT INTO Notification(type,title,message,ref_type,ref_id) VALUES('alert','Bin Alert',?,?,?)",
        [`Bin #${r.lastID} needs pickup`,'bin',r.lastID]);
    res.json({ bin_id:r.lastID, message:'Bin added' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.put('/api/bins/:id', async (req,res) => {
  try {
    const { fill_level,status,address } = req.body;
    if (fill_level!==undefined) {
      await run('UPDATE Bin SET fill_level=?,last_updated=CURRENT_TIMESTAMP WHERE bin_id=?',[fill_level,req.params.id]);
      if (fill_level>80) await run("INSERT INTO Notification(type,title,message,ref_type,ref_id) VALUES('alert','Bin Full',?,?,?)",[`Bin #${req.params.id} is ${fill_level}% full`,'bin',req.params.id]);
    }
    if (status!==undefined) await run('UPDATE Bin SET status=? WHERE bin_id=?',[status,req.params.id]);
    if (address!==undefined) await run('UPDATE Bin SET address=? WHERE bin_id=?',[sanitize(address),req.params.id]);
    res.json({ message:'Updated' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.delete('/api/bins/:id', async (req,res) => {
  try { await run('DELETE FROM Bin WHERE bin_id=?',[req.params.id]); res.json({ message:'Deleted' }); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

// ── TRUCKS ────────────────────────────────────────────────────────
app.get('/api/trucks', async (req,res) => {
  try {
    const rows=await all('SELECT t.*,z.zone_name FROM Truck t LEFT JOIN Zone z ON t.zone_id=z.zone_id ORDER BY t.status DESC');
    res.json(rows);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.put('/api/trucks/:id', async (req,res) => {
  try {
    const { status,current_lat,current_lng } = req.body;
    if (status) await run('UPDATE Truck SET status=?,last_updated=CURRENT_TIMESTAMP WHERE truck_id=?',[status,req.params.id]);
    if (current_lat&&current_lng) await run('UPDATE Truck SET current_lat=?,current_lng=?,last_updated=CURRENT_TIMESTAMP WHERE truck_id=?',[current_lat,current_lng,req.params.id]);
    res.json({ message:'Updated' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── ROUTE OPTIMIZATION ─────────────────────────────────────────────
app.get('/api/routes', async (req,res) => {
  try {
    const zones=await all('SELECT * FROM Zone');
    const result=[];
    for (const z of zones) {
      const bins=await all('SELECT * FROM Bin WHERE zone_id=? AND fill_level>20 ORDER BY fill_level DESC',[z.zone_id]);
      const truck=await get("SELECT * FROM Truck WHERE zone_id=? AND status!='maintenance' LIMIT 1",[z.zone_id]);
      if (!truck||!bins.length) continue;
      const avgFill=Math.round(bins.reduce((s,b)=>s+b.fill_level,0)/bins.length);
      result.push({
        zone_id:z.zone_id, zone_name:z.zone_name,
        truck, stops:bins, avg_fill:avgFill,
        priority:avgFill>70?'urgent':avgFill>40?'moderate':'normal',
        estimated_km:Math.round(bins.length*1.8+2),
        estimated_min:Math.round(bins.length*12+20)
      });
    }
    result.sort((a,b)=>b.avg_fill-a.avg_fill);
    res.json(result);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── COLLECTIONS ───────────────────────────────────────────────────
app.get('/api/collections', async (req,res) => {
  try {
    const rows=await all(`SELECT c.*,b.bin_type,b.address,z.zone_name,t.vehicle_no,t.driver_name
      FROM Collection c JOIN Bin b ON c.bin_id=b.bin_id JOIN Zone z ON b.zone_id=z.zone_id
      JOIN Truck t ON c.truck_id=t.truck_id ORDER BY c.collected_at DESC LIMIT 50`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/collections', async (req,res) => {
  try {
    const { bin_id,truck_id,weight_kg,notes } = req.body;
    const r=await run('INSERT INTO Collection(bin_id,truck_id,weight_kg,notes) VALUES(?,?,?,?)',[bin_id,truck_id,weight_kg,sanitize(notes||'')]);
    await run('UPDATE Bin SET fill_level=0,last_collected=CURRENT_TIMESTAMP,last_updated=CURRENT_TIMESTAMP WHERE bin_id=?',[bin_id]);
    res.json({ collection_id:r.lastID, message:'Collection logged, bin reset to 0%' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── SCHEDULES ─────────────────────────────────────────────────────
app.get('/api/schedules', async (req,res) => {
  try {
    const rows=await all(`SELECT s.*,z.zone_name,t.vehicle_no,t.driver_name,t.driver_phone
      FROM Schedule s JOIN Zone z ON s.zone_id=z.zone_id JOIN Truck t ON s.truck_id=t.truck_id
      ORDER BY s.pickup_day,s.pickup_time`);
    res.json(rows);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── COMPLAINTS ────────────────────────────────────────────────────
app.get('/api/complaints', async (req,res) => {
  try {
    const { status='',zone_id='' } = req.query;
    let sql='SELECT cp.*,z.zone_name FROM Complaint cp LEFT JOIN Zone z ON cp.zone_id=z.zone_id WHERE 1=1';
    const p=[];
    if (status) { sql+=' AND cp.status=?'; p.push(status); }
    if (zone_id) { sql+=' AND cp.zone_id=?'; p.push(zone_id); }
    sql+=' ORDER BY cp.created_at DESC';
    res.json(await all(sql,p));
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.post('/api/complaints', async (req,res) => {
  try {
    let { citizen_name,phone,zone_id,complaint_type,description,location_lat,location_lng,image_data } = req.body;
    citizen_name=sanitize(citizen_name); phone=sanitize(phone||''); description=sanitize(description||'');
    if (!citizen_name||!zone_id||!complaint_type) return res.status(400).json({ error:'Name, zone and type required' });
    const r=await run('INSERT INTO Complaint(citizen_name,phone,zone_id,complaint_type,description,location_lat,location_lng,image_data) VALUES(?,?,?,?,?,?,?,?)',
      [citizen_name,phone,zone_id,complaint_type,description,location_lat||null,location_lng||null,image_data||null]);
    await run("INSERT INTO Notification(type,title,message,ref_type,ref_id) VALUES('complaint','New Complaint',?,?,?)",[`${citizen_name} filed a complaint`,'complaint',r.lastID]);
    res.json({ complaint_id:r.lastID, message:'Complaint filed' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.put('/api/complaints/:id', async (req,res) => {
  try {
    const { status,admin_notes } = req.body;
    const resolved=status==='resolved'?new Date().toISOString():null;
    await run('UPDATE Complaint SET status=?,admin_notes=?,resolved_at=? WHERE complaint_id=?',
      [status,sanitize(admin_notes||''),resolved,req.params.id]);
    res.json({ message:'Updated' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

app.delete('/api/complaints/:id', async (req,res) => {
  try { await run('DELETE FROM Complaint WHERE complaint_id=?',[req.params.id]); res.json({ message:'Deleted' }); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

// ── NOTIFICATIONS ─────────────────────────────────────────────────
app.get('/api/notifications', async (req,res) => {
  try { res.json(await all('SELECT * FROM Notification ORDER BY created_at DESC LIMIT 30')); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

app.put('/api/notifications/read-all', async (req,res) => {
  try { await run('UPDATE Notification SET is_read=1'); res.json({ message:'All marked read' }); }
  catch(e) { res.status(500).json({ error:e.message }); }
});

// ── AI PREDICTION (Linear Regression in JS) ───────────────────────
app.get('/api/predict', async (req,res) => {
  try {
    const data=await all(`SELECT DATE(collected_at) d,ROUND(SUM(weight_kg),1) w
      FROM Collection GROUP BY DATE(collected_at) ORDER BY d`);
    if (data.length<2) return res.json({ prediction:[], trend:0 });
    const n=data.length;
    const xs=data.map((_,i)=>i);
    const ys=data.map(d=>d.w);
    const xMean=xs.reduce((a,b)=>a+b,0)/n;
    const yMean=ys.reduce((a,b)=>a+b,0)/n;
    const num=xs.reduce((s,x,i)=>s+(x-xMean)*(ys[i]-yMean),0);
    const den=xs.reduce((s,x)=>s+(x-xMean)**2,0);
    const slope=den?num/den:0;
    const intercept=yMean-slope*xMean;
    // Predict next 7 days
    const prediction=[];
    for (let i=0;i<7;i++) {
      const xi=n+i;
      const d=new Date(); d.setDate(d.getDate()+i+1);
      prediction.push({ date:d.toISOString().slice(0,10), predicted:Math.max(0,Math.round((slope*xi+intercept)*10)/10) });
    }
    res.json({ historical:data, prediction, slope:Math.round(slope*100)/100, trend:slope>0?'increasing':slope<0?'decreasing':'stable' });
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// ── START ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Smart Waste Management System        ║');
  console.log(`║   Running at http://localhost:${PORT}     ║`);
  console.log('║                                        ║');
  console.log(`║   Admin:  admin@pmc.gov.in / admin123  ║`);
  console.log(`║   Open:   frontend/login.html          ║`);
  console.log('╚════════════════════════════════════════╝\n');
});
