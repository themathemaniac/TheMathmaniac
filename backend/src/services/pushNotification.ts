import prisma from '../config/db';

interface ExpoPushPayload {
  to: string;
  sound: string;
  title: string;
  body: string;
  data?: any;
}

/**
 * Delivers a remote push notification using the Expo Push API.
 * Clears invalid/inactive device tokens from the database if they bounce.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: any
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });

    if (!user || !user.pushToken) {
      return;
    }

    const token = user.pushToken.trim();

    // Verify token follows Expo Push Token pattern
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
      console.log(`[Push Notification] Skipping invalid token format for user ${userId}: ${token}`);
      return;
    }

    const payload: ExpoPushPayload = {
      to: token,
      sound: 'default',
      title,
      body,
      data,
    };

    console.log(`[Push Notification] Dispatching to ${userId} (${token}): "${title}"`);

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(payload),
    });

    const result: any = await response.json();

    // Check if the response returned ticket details containing device errors
    if (result && result.data) {
      const ticket = result.data;
      if (ticket.status === 'error') {
        console.error(`[Push Notification Error] Failed to deliver: ${ticket.message}`);
        // Handle inactive/unregistered tokens by clearing them
        if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
          console.log(`[Push Notification] Clearing unregistered device token for user ${userId}`);
          await prisma.user.update({
            where: { id: userId },
            data: { pushToken: null },
          });
        }
      } else {
        console.log(`[Push Notification] Delivered successfully to user ${userId}`);
      }
    }
  } catch (error) {
    console.error(`[Push Notification Service Error] User ${userId}:`, error);
  }
}
