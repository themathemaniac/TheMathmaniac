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
  { name: "B.B.M. High School", aliases: ["BBM", "BBM High School"] },
  { name: "Madhyamgram High School", aliases: ["MHS", "Madhyamgram HS"] },
  { name: "Madhyamgram Girls' High School", aliases: ["MGHS", "Madhyamgram Girls"] },
  { name: "Sodepur High School", aliases: ["SHS", "Sodepur HS"] },
  { name: "Sodepur Chandrachur Vidyapith", aliases: ["SCV", "Chandrachur"] },
  { name: "Natagarh Swami Vivekananda Vidyamandir", aliases: ["NSVV", "Natagarh"] },
  { name: "Panihati Trannath High School", aliases: ["PTHS", "Trannath High School"] },
  { name: "Barasat Mahatma Gandhi Memorial High School", aliases: ["MGM", "MGM Barasat"] },
  { name: "Barasat Peary Charan Sarkar Government High School", aliases: ["PCSG", "Peary Charan"] },
  { name: "Birati Vidyalaya", aliases: ["BV", "Birati Vidyalaya"] },
  { name: "Kamarhati Sagore Dutt Free High School", aliases: ["KSD", "Sagore Dutt"] },
  { name: "Agarpara Mahajati Vidyapith", aliases: ["AMV", "Mahajati Vidyapith"] },
  { name: "Khardah Sibnath High School", aliases: ["KSHS", "Sibnath High School"] },
  { name: "Titagarh Free India High School", aliases: ["FIHS", "Free India"] },
  { name: "Barrackpore Government High School", aliases: ["BGHS", "Barrackpore Govt"] },
  { name: "DPS Megacity", aliases: ["DPS", "Delhi Public School"] },
  { name: "The Newtown School", aliases: ["TNS", "Newtown School"] },
  { name: "B.P. Poddar Institute", aliases: ["BP Poddar"] },
  { name: "H.B. Vidyapith", aliases: ["HBV", "HB Vidyapith"] },
  { name: "Holy Cross School", aliases: ["HCS", "Holy Cross"] },
  { name: "The Aryan School", aliases: ["TAS", "Aryan School"] },
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
