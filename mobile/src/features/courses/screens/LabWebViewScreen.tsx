import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

type LabWebViewRouteProp = {
  key: string;
  name: 'LabWebView';
  params: {
    url: string;
    title: string;
  };
};

export const LabWebViewScreen: React.FC = () => {
  const route = useRoute<LabWebViewRouteProp>();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { url, title } = route.params;
  const [loading, setLoading] = useState(true);

  return (
    <View className="flex-1 bg-slate-950 pt-12">
      {/* Header */}
      <View className="flex-row items-center px-4 pb-4 border-b border-slate-800">
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          className="p-2 mr-2 bg-slate-900 rounded-full"
        >
          <Text className="text-white text-lg font-bold">←</Text>
        </TouchableOpacity>
        <Text className="text-slate-100 text-lg font-bold flex-1" numberOfLines={1}>
          {title}
        </Text>
      </View>

      {/* WebView */}
      <View className="flex-1">
        {loading && (
          <View className="absolute inset-0 justify-center items-center z-10 bg-slate-950">
            <ActivityIndicator size="large" color="#2D8C82" />
            <Text className="text-slate-400 mt-4 text-xs font-medium tracking-widest uppercase">Loading Lab...</Text>
          </View>
        )}
        <WebView
          source={{ uri: url }}
          className="flex-1 bg-transparent"
          onLoadEnd={() => setLoading(false)}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>
    </View>
  );
};
