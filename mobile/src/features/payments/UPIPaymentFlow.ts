import { Linking, Platform } from 'react-native';

export const initiateUPIIntent = async (upiString: string): Promise<{ success: boolean; utrNumber?: string; message?: string }> => {
  try {
    const supported = await Linking.canOpenURL(upiString);
    if (!supported) {
      return { success: false, message: 'No UPI app found on your device to handle this payment. Please use the QR code fallback.' };
    }

    // Open the UPI Intent
    await Linking.openURL(upiString);

    // Since intercepting intent return data directly requires custom native bridging (`startActivityForResult`), 
    // we'll instruct the frontend to show a "Welcome Back" modal to manually accept the UTR 
    // after the user returns from the UPI app.
    return { success: true, message: 'UPI app opened successfully' };
  } catch (error: any) {
    console.error('Error launching UPI:', error);
    return { success: false, message: 'An error occurred while opening the UPI app.' };
  }
};
