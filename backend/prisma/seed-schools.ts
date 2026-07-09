import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const schools = [
  // User provided
  { name: "St. Jude's High School", aliases: ["SJHS", "St Judes", "St. Jude's", "st judes", "st. jude's"] },
  { name: "Sudhir Memorial Institute", aliases: ["SMI", "Sudhir Memorial"] },
  { name: "St. Xavier's Institution, Panihati", aliases: ["St Xaviers Panihati", "SXI Panihati", "St Xavier's Panihati"] },
  { name: "St. Xavier's Institution, Ruiya", aliases: ["St Xaviers Ruiya", "SXI Ruiya", "St Xavier's Ruiya"] },
  { name: "Auxilium Convent School", aliases: ["ACS", "Auxilium", "Auxilium Convent"] },
  { name: "Barasat Indira Gandhi Memorial High School", aliases: ["IGMHS", "Indira Gandhi Memorial", "BIGMHS"] },
  { name: "Kalyani Public School", aliases: ["KPS", "Kalyani Public", "Kalyani Public High School"] },
  { name: "Central Modern School", aliases: ["CMS", "Central Modern"] },
  { name: "National Model School", aliases: ["NMS", "National Model"] },

  // Added based on location (Madhyamgram, Sodepur, Barasat, Birati)
  { name: "Julien Day School, Ganganagar", aliases: ["JDS", "Julien Day", "JDS Ganganagar"] },
  { name: "Adamas International School", aliases: ["AIS", "Adamas"] },
  { name: "Narayana School, Barasat", aliases: ["Narayana Barasat", "Narayana"] },
  { name: "Narayana School, Sodepur", aliases: ["Narayana Sodepur", "Narayana"] },
  { name: "Aditya Academy Secondary, Barasat", aliases: ["AAS", "Aditya Academy"] },
  { name: "St. Stephen's School, Dum Dum", aliases: ["St Stephens", "SSS"] },
  { name: "National English School", aliases: ["NES", "National English"] },
  { name: "St. Mary's Orphanage & Day School", aliases: ["SMODS", "St Marys"] },
  { name: "Douglas Memorial Higher Secondary School", aliases: ["DMHSS", "Douglas Memorial"] },
  { name: "Guru Nanak Public School", aliases: ["GNPS", "Guru Nanak"] },
  { name: "Assembly of Christ School", aliases: ["ACS Barrackpore", "Assembly of Christ"] },
  { name: "St. Augustine's Day School", aliases: ["SADS", "St Augustines"] },
  { name: "Modern English Academy", aliases: ["MEA", "Modern English"] },

  // English Medium Schools: Barasat to Durganagar & Sodepur/Panihati/Khardah Region
  { name: "Central Point School, Barasat", aliases: ["CPS Barasat", "Central Point"] },
  { name: "Brainware Vidyashram, Barasat", aliases: ["Brainware Vidyashram"] },
  { name: "Kingston Model School, Barasat", aliases: ["Kingston Model School", "KMS"] },
  { name: "Adamas Knowledge City, Barasat", aliases: ["Adamas Barasat"] },
  { name: "Camellia Public School, Madhyamgram", aliases: ["Camellia Public School", "CPS Madhyamgram"] },
  { name: "Monalisa English School, Madhyamgram", aliases: ["Monalisa English School"] },
  { name: "Vivekananda English Academy, Madhyamgram", aliases: ["Vivekananda English Academy", "VEA"] },
  { name: "Vidyasagar Academy, New Barrackpore", aliases: ["Vidyasagar Academy"] },
  { name: "St. Stephen's School, Birati", aliases: ["St Stephens Birati"] },
  { name: "Calcutta Airport English High School", aliases: ["CAEHS", "Airport English High School"] },
  { name: "North Point Senior Secondary Boarding School", aliases: ["North Point", "NPSSBS"] },
  { name: "The Aryans School, Sodepur", aliases: ["Aryans School Sodepur", "TAS"] },
  { name: "Bengal United School, Sodepur", aliases: ["Bengal United School"] },
  { name: "Zenith Public School, Sodepur", aliases: ["Zenith Public School"] },
  { name: "Rose Bank Edu Care High School, Sodepur", aliases: ["Rose Bank"] },
  { name: "Rahara Ramakrishna Mission (English Medium)", aliases: ["Rahara RKM", "Ramakrishna Mission Rahara"] },
  { name: "St. Jude's High School, Khardah", aliases: ["St Judes Khardah", "SJHS Khardah"] },
  { name: "The Central Modern School, Baranagar", aliases: ["Central Modern Baranagar"] },
  { name: "DPS North Kolkata", aliases: ["DPS North", "Delhi Public School North Kolkata"] },
  { name: "Army Public School, Barrackpore", aliases: ["APS Barrackpore", "APS"] },

  // Local Colleges & Universities
  { name: "Barasat Government College", aliases: ["BGC", "Barasat Govt College"] },
  { name: "Barasat College", aliases: ["Barasat College"] },
  { name: "Brainware University, Barasat", aliases: ["Brainware University", "BWU"] },
  { name: "Adamas University, Barasat", aliases: ["Adamas University", "AU"] },
  { name: "Vivekananda College, Madhyamgram", aliases: ["Vivekananda College"] },
  { name: "Acharya Prafulla Chandra College", aliases: ["APC College", "New Barrackpore College"] },
  { name: "Panihati Mahavidyalaya, Sodepur", aliases: ["Panihati College"] },
  { name: "Guru Nanak Institute of Technology, Panihati", aliases: ["GNIT", "Guru Nanak Institute"] },
  { name: "Narula Institute of Technology, Agarpara", aliases: ["NIT Agarpara", "Narula"] },
  { name: "RKMVC College, Rahara", aliases: ["RKMVC", "Ramakrishna Mission Vivekananda Centenary College"] },
  { name: "Bhairab Ganguly College, Belgharia", aliases: ["BGC Belgharia", "Bhairab Ganguly"] },

  // Deeper Barasat Region
  { name: "Regent Education and Research Foundation", aliases: ["RERF", "Regent Institute"] },
  { name: "West Bengal State University, Barasat", aliases: ["WBSU", "West Bengal State University"] },
  { name: "BCDA College of Pharmacy & Technology", aliases: ["BCDA College", "BCDA"] },
  { name: "Kingston Educational Institute", aliases: ["KEI", "Kingston"] },

  // Newtown & Salt Lake Region
  { name: "Institute of Engineering and Management, Salt Lake", aliases: ["IEM", "IEM Salt Lake"] },
  { name: "University of Engineering and Management, New Town", aliases: ["UEM", "UEM New Town"] },
  { name: "Techno India University, Salt Lake", aliases: ["TIU", "Techno India Salt Lake"] },
  { name: "Sister Nivedita University, New Town", aliases: ["SNU", "Sister Nivedita"] },
  { name: "Aliah University, New Town", aliases: ["Aliah University"] },
  { name: "Amity University, New Town", aliases: ["Amity", "Amity University Kolkata"] },
  { name: "St. Joan's School, Salt Lake", aliases: ["St Joans"] },
  { name: "Hariyana Vidya Mandir, Salt Lake", aliases: ["HVM", "Hariyana Vidya Mandir"] },
  { name: "Salt Lake School", aliases: ["SLS", "Salt Lake School"] },
  { name: "Bharatiya Vidya Bhavan, Salt Lake", aliases: ["Bhavans", "BVB"] },
  { name: "Apeejay School, Salt Lake", aliases: ["Apeejay Salt Lake"] },
];

async function main() {
  console.log('Seeding schools...');
  for (const school of schools) {
    try {
      await prisma.school.upsert({
        where: { name: school.name },
        update: { aliases: school.aliases },
        create: {
          name: school.name,
          aliases: school.aliases,
        },
      });
      console.log(`Upserted school: ${school.name}`);
    } catch (error) {
      console.error(`Error upserting ${school.name}:`, error);
    }
  }
  console.log('Finished seeding schools.');
}

main()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
