import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';
import { WebView } from 'react-native-webview';

import { apiClient } from '../../../core/api/client';

type PDFViewerRouteProp = RouteProp<RootStackParamList, 'PDFViewer'>;
type PDFViewerNavigationProp = StackNavigationProp<RootStackParamList, 'PDFViewer'>;

interface Props {
  route: PDFViewerRouteProp;
}

export const PDFViewerScreen: React.FC<Props> = ({ route }) => {
  const { title, fileUrl } = route.params;
  const navigation = useNavigation<PDFViewerNavigationProp>();

  const apiBase = apiClient.defaults.baseURL || '';
  const rootUrl = apiBase.replace('/api/v1', '');

  // Dynamically resolve local server IP changes or http->https for API routes and uploads
  let resolvedFileUrl = fileUrl;
  if (fileUrl && fileUrl.includes('/api/v1/materials/')) {
    const apiPath = fileUrl.substring(fileUrl.indexOf('/api/v1/materials/'));
    resolvedFileUrl = `${rootUrl}${apiPath}`;
  } else if (fileUrl && fileUrl.includes('/uploads/')) {
    const uploadPath = fileUrl.substring(fileUrl.indexOf('/uploads/'));
    resolvedFileUrl = `${rootUrl}${uploadPath}`;
  }

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
    Linking.openURL(resolvedFileUrl).catch(() => {
      Alert.alert('Error', 'Unable to open this PDF on your device.');
    });
  };

  const isAndroid = Platform.OS === 'android';

  const htmlSource = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=2, user-scalable=yes">
  <style>
    body { margin: 0; padding: 0; background-color: #020617; display: flex; flex-direction: column; align-items: center; }
    #pdf-container { display: flex; flex-direction: column; align-items: center; width: 100%; padding: 10px 0; }
    canvas { width: 95% !important; height: auto !important; margin-bottom: 12px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); }
    #loading { color: #94a3b8; font-family: sans-serif; font-size: 14px; text-align: center; margin-top: 50px; font-weight: bold; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"></script>
</head>
<body>
  <div id="loading">Loading PDF Document...</div>
  <div id="pdf-container"></div>

  <script>
    const url = '${resolvedFileUrl}';
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

    const loadingTask = pdfjsLib.getDocument(url);
    loadingTask.promise.then(function(pdf) {
      document.getElementById('loading').style.display = 'none';
      const container = document.getElementById('pdf-container');
      
      // Render all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        pdf.getPage(pageNum).then(function(page) {
          const viewport = page.getViewport({ scale: 2.0 }); // High quality scaling
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          container.appendChild(canvas);

          const renderContext = {
            canvasContext: context,
            viewport: viewport
          };
          page.render(renderContext);
        });
      }
    }, function (reason) {
      document.getElementById('loading').innerHTML = 'Error loading PDF: ' + reason.message;
      console.error(reason);
    });
  </script>
</body>
</html>
  `;

  const webViewSource = isAndroid
    ? { html: htmlSource, baseUrl: rootUrl }
    : { uri: resolvedFileUrl };

  const showWebView = !webViewError;

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
             <ActivityIndicator size="small" color="#2D8C82" />
          ) : (
            <Text className="text-blue-400 text-sm font-semibold">Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* PDF View Container */}
      <View className="flex-1">
        {showWebView ? (
          <WebView
            source={webViewSource}
            className="flex-1"
            onError={() => setWebViewError(true)}
            startInLoadingState={true}
            originWhitelist={['*']}
            mixedContentMode="always"
            scalesPageToFit={true}
            renderLoading={() => (
              <View className="absolute inset-0 justify-center items-center bg-slate-950">
                 <ActivityIndicator size="large" color="#2D8C82" />
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
                Unable to display PDF document. Please download it or open in another application.
              </Text>
              
              <TouchableOpacity
                onPress={handleOpenNatively}
                className="bg-blue-600 px-6 py-3 rounded-2xl w-full items-center active:opacity-90"
              >
                <Text className="text-white text-xs font-bold">Open in Browser</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

