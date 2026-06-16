import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { WebView } from 'react-native-webview';

type PDFViewerRouteProp = RouteProp<RootStackParamList, 'PDFViewer'>;
type PDFViewerNavigationProp = StackNavigationProp<RootStackParamList, 'PDFViewer'>;

interface Props {
  route: PDFViewerRouteProp;
}

export const PDFViewerScreen: React.FC<Props> = ({ route }) => {
  const { title, fileUrl } = route.params;
  const navigation = useNavigation<PDFViewerNavigationProp>();
  const [downloading, setDownloading] = useState(false);
  const [webViewError, setWebViewError] = useState(false);

  const simulateDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      Alert.alert('Download Complete', `${title} has been downloaded to your local device successfully.`);
    }, 1500);
  };

  const handleOpenNatively = () => {
    Linking.openURL(fileUrl).catch(() => {
      Alert.alert('Error', 'Unable to open this PDF on your device.');
    });
  };

  // On iOS, WebView renders PDFs natively.
  // On Android, we can try using Google Docs Viewer if it's a public URL.
  // If it's a local address (like localhost or 10.24.204.100), Google Docs Viewer won't work 
  // since Google's cloud servers cannot resolve the local private IP. In that case, we prompt 
  // the user to open/download it natively using the browser/PDF viewer.
  const isLocalUrl = fileUrl.includes('localhost') || 
                     fileUrl.includes('127.0.0.1') || 
                     fileUrl.includes('192.168.') || 
                     fileUrl.includes('10.');

  const webViewUri = Platform.OS === 'ios'
    ? fileUrl
    : (!isLocalUrl
        ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(fileUrl)}`
        : fileUrl);

  const showWebView = !webViewError && (Platform.OS === 'ios' || !isLocalUrl);

  return (
    <View className="flex-1 bg-slate-950">
      {/* Header */}
      <View className="bg-slate-900 border-b border-slate-800/80 px-6 pt-14 pb-4 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 bg-slate-800 border border-slate-700/60 rounded-full justify-center items-center"
        >
          <Text className="text-slate-100 text-lg font-bold">←</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 text-base font-bold flex-1 ml-4 text-center" numberOfLines={1}>
          {title}
        </Text>
        <TouchableOpacity onPress={simulateDownload} disabled={downloading}>
          {downloading ? (
            <ActivityIndicator size="small" color="#8A2222" />
          ) : (
            <Text className="text-blue-400 text-sm font-semibold">Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* PDF View Container */}
      <View className="flex-1">
        {showWebView ? (
          <WebView
            source={{ uri: webViewUri }}
            className="flex-1"
            onError={() => setWebViewError(true)}
            startInLoadingState={true}
            renderLoading={() => (
              <View className="absolute inset-0 justify-center items-center bg-slate-950">
                <ActivityIndicator size="large" color="#8A2222" />
                <Text className="text-slate-500 text-xs mt-3 font-semibold">Loading PDF Document...</Text>
              </View>
            )}
          />
        ) : (
          <View className="flex-1 p-6 justify-center items-center bg-slate-950">
            <View className="bg-slate-900 border border-slate-800 rounded-3xl p-8 items-center justify-center w-full max-w-sm">
              <Text className="text-5xl mb-4">📄</Text>
              <Text className="text-slate-100 text-sm font-black text-center mb-2">
                {title}
              </Text>
              <Text className="text-slate-500 text-xs text-center mb-6 leading-relaxed">
                Local network PDF files on Android are best viewed in the device's native browser or PDF reader.
              </Text>
              
              <TouchableOpacity
                onPress={handleOpenNatively}
                className="bg-blue-600 px-6 py-3 rounded-2xl w-full items-center active:opacity-90"
              >
                <Text className="text-white text-xs font-bold">Open PDF Natively</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

