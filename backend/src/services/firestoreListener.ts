import { db, isFirebaseEnabled } from '../config/firebase';
import prisma from '../config/db';

function setupCollectionListener(collectionName: string, defaultRole: 'STUDENT' | 'TEACHER' | 'ADMIN') {
  if (!db) return;

  console.log(`[Sync Listener] Starting Firestore real-time sync listener on "${collectionName}" collection...`);

  db.collection(collectionName).onSnapshot(async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      const docData = change.doc.data();
      const userId = change.doc.id;

      if (change.type === 'added' || change.type === 'modified') {
        try {
          const { name, role, email, firstLogin, stream, faculty, school } = docData;
          const studentClass = docData.class;

          // Force the role based on the collection source
          const finalRole = collectionName === 'students' ? 'STUDENT' : 
                            (collectionName === 'teachers' ? 'TEACHER' : 
                            (collectionName === 'admin' ? 'ADMIN' : (role || defaultRole)));

          // Fetch user from Prisma SQLite by id
          const existingUserById = await prisma.user.findUnique({
            where: { id: userId },
          });

          // Check if there is an actual difference to avoid infinite update loops
          const needsUpdate = (user: any) => {
            return (
              user.name !== name ||
              user.role !== finalRole ||
              user.email !== (email || null) ||
              user.firstLogin !== (firstLogin !== undefined ? firstLogin : true) ||
              user.stream !== (stream || null) ||
              user.class !== (studentClass || null) ||
              user.faculty !== (faculty || null) ||
              user.school !== (school || null)
            );
          };

          if (existingUserById) {
            if (needsUpdate(existingUserById)) {
              await prisma.user.update({
                where: { id: userId },
                data: {
                  name: name || 'Mathemaniac User',
                  role: finalRole,
                  email: email || null,
                  firstLogin: firstLogin !== undefined ? firstLogin : true,
                  stream: stream || null,
                  class: studentClass || null,
                  faculty: faculty || null,
                  school: school || null,
                },
              });
              console.log(`[Sync Listener] Updated user ${userId} in SQLite database.`);
            }
          } else {
            // New user entirely
            await prisma.user.create({
              data: {
                id: userId,
                name: name || 'Mathemaniac User',
                role: finalRole,
                email: email || null,
                firstLogin: firstLogin !== undefined ? firstLogin : true,
                stream: stream || null,
                class: studentClass || null,
                faculty: faculty || null,
                school: school || null,
              },
            });
            console.log(`[Sync Listener] Created user ${userId} in SQLite database.`);
          }
        } catch (err: any) {
          console.error(`[Sync Listener] Error syncing added/modified user ${userId} in "${collectionName}":`, err.message);
        }
      }

      if (change.type === 'removed') {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { id: userId },
          });

          if (existingUser) {
            console.log(`[Sync Listener] User ${userId} removed from Firestore "${collectionName}". Cleaning up SQLite...`);
            
            await prisma.$transaction([
              prisma.notification.deleteMany({ where: { userId } }),
              prisma.lectureProgress.deleteMany({ where: { userId } }),
              prisma.purchase.deleteMany({ where: { userId } }),
              prisma.result.deleteMany({ where: { userId } }),
              prisma.user.delete({ where: { id: userId } }),
            ]);
            console.log(`[Sync Listener] Successfully deleted user ${userId} and all related records from SQLite.`);
          }
        } catch (err: any) {
          console.error(`[Sync Listener] Error syncing removed user ${userId} in "${collectionName}":`, err.message);
        }
      }
    }
  }, (error) => {
    console.error(`[Sync Listener] Firestore onSnapshot error on collection "${collectionName}":`, error);
  });
}

export function startFirestoreListener() {
  if (!isFirebaseEnabled || !db) {
    console.warn('[Sync Listener] Firebase is disabled. Firestore real-time sync listener will not start.');
    return;
  }

  // Set up listeners for the collections
  setupCollectionListener('students', 'STUDENT');
  setupCollectionListener('teachers', 'TEACHER');
  setupCollectionListener('admin', 'ADMIN');
}
