import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { db, isFirebaseEnabled } from '../src/config/firebase';

const prisma = new PrismaClient();

async function syncToFirestore(user: { id: string; name: string; phoneNumber: string; role: string; passwordHash: string | null; passphraseHash: string | null; firstLogin: boolean }) {
  if (isFirebaseEnabled && db) {
    try {
      let collectionName = 'students';
      if (user.role === 'TEACHER') {
        collectionName = 'teachers';
      } else if (user.role === 'ADMIN') {
        collectionName = 'admin';
      }
      await db.collection(collectionName).doc(user.id).set({
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.role,
        passwordHash: user.passwordHash,
        passphraseHash: user.passphraseHash,
        firstLogin: user.firstLogin,
      }, { merge: true });
      console.log(`[Seed Firebase] Synced ${user.name} to Firestore collection "${collectionName}"`);
    } catch (err: any) {
      console.error(`[Seed Firebase Error] Failed to sync ${user.name}:`, err.message);
    }
  }
}

async function main() {
  console.log('Seeding database...');

  // Clean existing tables
  await prisma.notification.deleteMany({});
  await prisma.announcement.deleteMany({});
  await prisma.studyMaterial.deleteMany({});
  await prisma.result.deleteMany({});
  await prisma.questionOption.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.test.deleteMany({});
  await prisma.purchase.deleteMany({});
  await prisma.lectureProgress.deleteMany({});
  await prisma.lecture.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.courseCategory.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Seed Users (Student and Admin)
  const passwordHash = await bcrypt.hash('password123', 10);
  const studentPassphraseHash = await bcrypt.hash('STUDENT-RECOVERY-5555', 10);
  const adminPassphraseHash = await bcrypt.hash('ADMIN-RECOVERY-9999', 10);

  const testStudent = await prisma.user.create({
    data: {
      name: 'Raunak Dey',
      email: 'raunak@outlook.com',
      firstLogin: true,
      role: 'STUDENT',
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      id: '2fed78e3-fa1d-4b1c-8879-d246a603e16a', // Align with Firestore ID
      name: 'Mathemaniac Admin',
      firstLogin: false,
      role: 'ADMIN',
    },
  });

  await syncToFirestore({
    id: testStudent.id,
    name: testStudent.name,
    role: testStudent.role,
    firstLogin: testStudent.firstLogin,
    phoneNumber: '+919831754957',
    passwordHash,
    passphraseHash: studentPassphraseHash,
  });

  await syncToFirestore({
    id: adminUser.id,
    name: adminUser.name,
    role: adminUser.role,
    firstLogin: adminUser.firstLogin,
    phoneNumber: '+917890302020',
    passwordHash,
    passphraseHash: adminPassphraseHash,
  });

  console.log(`Users seeded: Student ID: ${testStudent.id}, Admin ID: ${adminUser.id}`);

  console.log('Seed completed for core users.');

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
