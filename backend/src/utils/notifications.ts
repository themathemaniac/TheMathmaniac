import prisma from '../config/db';
import { sendPushNotification } from '../services/pushNotification';

/**
 * Creates an in-app database notification and simultaneously dispatches a remote push notification.
 */
export async function createNotificationAndPush(
  userId: string,
  title: string,
  body: string,
  data?: any
): Promise<any> {
  try {
    // 1. Create database notification record (for in-app notification center)
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        body,
        read: false,
      },
    });

    // 2. Dispatch background push alert to device asynchronously
    sendPushNotification(userId, title, body, data).catch((err) => {
      console.error('[Background Push Trigger Error]', err);
    });

    return notification;
  } catch (error) {
    console.error('[Create Notification And Push Error]:', error);
    throw error;
  }
}
