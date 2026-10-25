import type { TeacherPunchEntry } from "@/lib/teacherPunches";

export type PartnerType = "cashpor" | "schools" | "colleges" | "corporates" | "institutions";

export const PARTNER_TYPES: { value: Exclude<PartnerType, "cashpor">; label: string; noun: string }[] = [
  { value: "schools", label: "Schools", noun: "School" },
  { value: "colleges", label: "Colleges", noun: "College" },
  { value: "corporates", label: "Corporates", noun: "Corporate" },
  { value: "institutions", label: "Other Institution", noun: "Institution" },
];

const SCHOOL_NAMES = [
  "Greenwood Public School", "St. Mary's Convent School", "Sunrise Academy", "Little Scholars High School",
  "Rainbow International School", "Shanti Niketan Vidyalaya", "DAV Public School", "Springdale High School",
  "Mount Carmel School", "Navodaya Central School", "Bright Future Academy", "Holy Cross School",
  "Vidya Mandir Public School", "Saraswati Bal Vidyalaya", "New Horizon School", "Lotus Valley School",
  "Gyan Deep Academy", "Modern Public School", "Cambridge Senior Secondary School", "Rosewood International School",
  "Delhi Public Academy", "Pragati Vidyalaya", "Little Angels School", "Kendriya Model School",
  "Silver Oak Public School", "Heritage Academy", "City Convent School", "Bal Bharati Public School",
  "St. Xavier's High School", "Orchid Valley School", "Sunbeam Public School", "Tagore International School",
  "Jawahar Model School", "Pearl Convent School", "Golden Gate Academy", "Everest Public School",
  "Scholars Home Academy", "Blue Bells School", "Green Valley High School", "Arya Public School",
  "Little Millennium School", "Starlight Academy", "Unity Public School", "Wisdom Tree School",
  "Mother Teresa School", "Excellence Academy", "Rainbow Kids School", "Pioneer Public School",
  "Milestone High School", "Bright Minds Academy",
];

const COLLEGE_NAMES = [
  "St. Stephen's Degree College", "National Institute of Commerce", "City Arts College", "Government Science College",
  "Shri Ram College of Arts", "Lakshmi Narain College", "Modern Institute of Technology", "Central College of Education",
  "Sunrise Business School", "Pioneer Engineering College", "Vidya College of Science", "Unity Degree College",
  "Heritage Law College", "New Age Institute of Design", "Metro College of Commerce", "Shanti Women's College",
  "Excellence Institute of Management", "Gateway College of Arts", "Paramount Science College", "Apex Degree College",
  "Royal College of Pharmacy", "Horizon Institute of Technology", "Liberal Arts College", "Zenith Commerce College",
  "Trinity College of Education", "Summit Institute of Science", "Cosmos Degree College", "Prestige College of Arts",
  "Radiance Institute of Management", "Noble Science College", "Saraswati College of Humanities", "Vision Tech College",
  "Millennium Degree College", "Frontier College of Commerce", "Everest Institute of Science", "Crown Arts College",
  "Empire Business College", "Lotus College of Education", "Orbit Institute of Technology", "Pearl Degree College",
  "Beacon College of Science", "Atlas Commerce College", "Regal Institute of Management", "Sapphire Arts College",
  "Victory Degree College", "Aurora College of Technology", "Legacy Institute of Science", "Crescent Arts College",
  "Pinnacle Business School", "Harmony Degree College",
];

const CORPORATE_NAMES = [
  "TechNova Solutions", "Zenith Consulting Group", "BrightPath Industries", "NovaEdge Technologies",
  "Summit Financial Services", "BlueOrbit Software", "Pioneer Logistics", "Vertex Manufacturing",
  "ClearSky Analytics", "IronPeak Infrastructure", "SilverLine Retail Group", "NextGen Pharma",
  "UrbanCore Developers", "SwiftWave Telecom", "GreenField Agro Corp", "PrimeAxis Insurance",
  "CoreBridge IT Services", "AlphaStar Enterprises", "MetroLink Transport", "SunRise Energy Corp",
  "DataPoint Systems", "TrueNorth Consulting", "EverPeak Holdings", "BrightWave Media",
  "SolidState Electronics", "FreshMart Retail Chain", "SkyHigh Aviation Services", "DeepRoot Finance",
  "QuickServe Hospitality", "MegaBuild Constructions", "SmartGrid Utilities", "ProEdge Security Services",
  "VitalCare Health Systems", "StarBridge Capital", "OpenSource Labs", "FastTrack Couriers",
  "ClearView Optics", "TerraNova Mining", "AquaPure Industries", "BrightSpark Electricals",
  "NovaCraft Furniture", "EliteEdge Sports Goods", "CloudNine Travel Group", "PureHarvest Foods",
  "SteelWorks Fabrication", "UrbanNest Realty", "InfoSphere Technologies", "GreenLeaf Packaging",
  "PrecisionTools Manufacturing", "HorizonLine Shipping",
];

const INSTITUTION_NAMES = [
  "Career Bridge Foundation", "Skill Rise Trust", "Udaan Learning Center", "Prayas Skill Academy",
  "Sankalp Training Institute", "Navjeevan Foundation", "Pratham Skill Center", "Ashray Vocational Institute",
  "Ujjwal Career Academy", "Saksham Foundation", "Nayi Disha Trust", "Kaushal Vikas Kendra",
  "Rise Up Learning Hub", "Sarthi Career Institute", "Vigyan Skill Foundation", "Jyoti Training Academy",
  "Samriddhi Foundation", "Eklavya Skill Center", "Abhyudaya Learning Trust", "Manthan Career Academy",
  "Tarunodaya Institute", "Swayam Skill Foundation", "Lakshya Career Center", "Nirmaan Training Trust",
  "Pragati Skill Academy", "Umang Learning Center", "Yuva Shakti Foundation", "Sangathan Skill Institute",
  "Hope Career Academy", "Disha Vocational Trust", "Spark Learning Foundation", "Bridge Gap Institute",
  "Aspire Skill Center", "Momentum Training Academy", "Catalyst Career Trust", "Empower Skill Foundation",
  "Vision Quest Institute", "Reach Out Learning Hub", "Step Up Career Academy", "Nurture Skill Trust",
  "Horizon Skill Foundation", "Transform Career Center", "Elevate Training Institute", "Launch Pad Academy",
  "Grow Skill Foundation", "Ascend Career Trust", "Momentum Learning Center", "Pathways Skill Institute",
  "Bright Start Academy", "Career Craft Foundation",
];

const NAME_POOLS: Record<Exclude<PartnerType, "cashpor">, string[]> = {
  schools: SCHOOL_NAMES,
  colleges: COLLEGE_NAMES,
  corporates: CORPORATE_NAMES,
  institutions: INSTITUTION_NAMES,
};

export const partnerInstitutions = (type: Exclude<PartnerType, "cashpor">): string[] => NAME_POOLS[type];

const SUBJECTS = ["English", "Math", "Science", "Career Guidance", "Computer Skills"];
const TOPICS: Record<string, string[]> = {
  English: ["Reading comprehension", "Spoken English practice", "Grammar: tenses", "Essay writing"],
  Math: ["Algebra basics", "Geometry: triangles", "Fractions & decimals", "Word problems"],
  Science: ["Photosynthesis", "Electric circuits", "Human body systems", "States of matter"],
  "Career Guidance": ["Choosing a stream", "Resume building", "Interview skills", "Career mapping session"],
  "Computer Skills": ["Typing practice", "Intro to spreadsheets", "Internet safety", "Email basics"],
};

// Deterministic PRNG so every institution always shows the same demo data.
const seededRandom = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Demo punch entries (~40–80 classes over 4 months) for one institution. */
export const demoPunchEntries = (type: Exclude<PartnerType, "cashpor">, name: string): TeacherPunchEntry[] => {
  const rand = seededRandom(`${type}:${name}`);
  const entries: TeacherPunchEntry[] = [];
  const classes = 40 + Math.floor(rand() * 40);
  const now = new Date();

  for (let i = 0; i < classes; i++) {
    const daysAgo = Math.floor(rand() * 120);
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    const subject = SUBJECTS[Math.floor(rand() * SUBJECTS.length)];
    const topics = TOPICS[subject];
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    entries.push({
      teacher: "Demo Faculty",
      center: name,
      subject,
      students: 12 + Math.floor(rand() * 30),
      topic: topics[Math.floor(rand() * topics.length)],
      subTopic: "Demo sub-topic",
      week: `Week ${Math.ceil(d.getDate() / 7)}`,
      reportingTeacher: "",
      date,
      monthKey: date.slice(0, 7),
      merged: rand() < 0.08,
    });
  }
  return entries;
};
