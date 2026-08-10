import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

// Updated lab data structure
const PRIMARY_LABS = [
  {
    id: 'a1',
    platform: 'Alchemax',
    subject: 'Chemistry',
    topic: 'Titration & Solutions',
    title: 'Acid-Base Titration',
    description: 'Advanced chemistry simulation for titration.',
    url: 'https://alchemax-inky.vercel.app/',
    icon: '🧪',
    color: 'bg-indigo-500/20',
    borderColor: 'border-indigo-500/50',
    textColor: 'text-indigo-400',
    platformColor: 'text-indigo-300'
  },
  {
    id: 'a2',
    platform: 'Alchemax',
    subject: 'Chemistry',
    topic: 'Molecular Structures',
    title: 'Molecular Modeling',
    description: 'Build and analyze 3D molecular structures.',
    url: 'https://alchemax-inky.vercel.app/',
    icon: '🧬',
    color: 'bg-indigo-500/20',
    borderColor: 'border-indigo-500/50',
    textColor: 'text-indigo-400',
    platformColor: 'text-indigo-300'
  },
  {
    id: 'g1',
    platform: 'Graviton',
    subject: 'Physics',
    topic: 'Mechanics',
    title: 'Kinematics Lab',
    description: 'Explore motion, velocity, and acceleration.',
    url: 'https://graviton-gamma.vercel.app/',
    icon: '⚛️',
    color: 'bg-fuchsia-500/20',
    borderColor: 'border-fuchsia-500/50',
    textColor: 'text-fuchsia-400',
    platformColor: 'text-fuchsia-300'
  },
  {
    id: 'g2',
    platform: 'Graviton',
    subject: 'Physics',
    topic: 'Electromagnetism',
    title: 'Circuit Dynamics',
    description: 'Advanced circuit building and testing.',
    url: 'https://graviton-gamma.vercel.app/',
    icon: '⚡',
    color: 'bg-fuchsia-500/20',
    borderColor: 'border-fuchsia-500/50',
    textColor: 'text-fuchsia-400',
    platformColor: 'text-fuchsia-300'
  }
];

const SECONDARY_LABS = [
  {
    id: 'p1',
    platform: 'PhET',
    title: 'Forces and Motion',
    description: 'Interactive simulations for kinematics and dynamics.',
    url: 'https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_en.html',
    icon: '🚀',
    color: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    textColor: 'text-blue-400'
  },
  {
    id: 'p2',
    platform: 'PhET',
    title: 'Circuit Construction',
    description: 'Build and test electrical circuits safely.',
    url: 'https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc_en.html',
    icon: '🔌',
    color: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    textColor: 'text-amber-400'
  },
  {
    id: 'o1',
    platform: 'Other',
    title: 'Biology Microscopy',
    description: 'Explore cells under a virtual microscope.',
    url: 'https://www.ncbionetwork.org/iet/microscope/',
    icon: '🔬',
    color: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    textColor: 'text-emerald-400'
  }
];

export const VirtualLabScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const renderPrimaryLab = (lab: typeof PRIMARY_LABS[0]) => (
    <TouchableOpacity
      key={lab.id}
      className={`w-full rounded-3xl p-5 mb-4 border ${lab.borderColor} ${lab.color} active:opacity-70`}
      onPress={() => navigation.navigate('LabWebView', { url: lab.url, title: lab.title })}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-slate-900/50 justify-center items-center mr-3">
            <Text className="text-xl">{lab.icon}</Text>
          </View>
          <View>
            <Text className={`text-[10px] font-bold uppercase tracking-wider ${lab.platformColor}`}>
              Powered by {lab.platform}
            </Text>
            <Text className="text-slate-300 text-[10px]">{lab.subject} • {lab.topic}</Text>
          </View>
        </View>
        <View className="bg-slate-900/60 px-3 py-1.5 rounded-full">
          <Text className="text-white text-xs font-bold">Open Lab</Text>
        </View>
      </View>
      
      <Text className="text-slate-100 font-black text-lg mb-1">{lab.title}</Text>
      <Text className={`text-xs font-medium ${lab.textColor}`}>{lab.description}</Text>
    </TouchableOpacity>
  );

  const renderSecondaryLab = (lab: typeof SECONDARY_LABS[0]) => (
    <TouchableOpacity
      key={lab.id}
      className={`w-[48%] rounded-2xl p-4 mb-4 border ${lab.borderColor} ${lab.color} active:opacity-70`}
      onPress={() => navigation.navigate('LabWebView', { url: lab.url, title: lab.title })}
    >
      <View className="w-10 h-10 rounded-full bg-slate-900/30 justify-center items-center mb-3">
        <Text className="text-xl">{lab.icon}</Text>
      </View>
      <Text className="text-slate-100 font-bold text-sm mb-1" numberOfLines={1}>{lab.title}</Text>
      <Text className={`text-[10px] font-medium ${lab.textColor}`} numberOfLines={2}>{lab.description}</Text>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-slate-950 px-5 pt-14">
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-slate-100 text-2xl font-black">Virtual Labs</Text>
          <Text className="text-slate-400 text-xs mt-1">Interactive Learning Environments</Text>
        </View>
        <Image
          source={require('../../../../assets/Mathemaniac_Logo_Padded.png')}
          className="w-20 h-14 rounded-full border border-slate-700/60"
          resizeMode="cover"
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        <View className="mb-6">
          <Text className="text-white text-lg font-bold mb-4">Featured Labs</Text>
          {PRIMARY_LABS.map(renderPrimaryLab)}
        </View>

        <View className="mb-2">
          <View className="h-[1px] bg-slate-800 w-full mb-6" />
          <Text className="text-slate-300 text-sm font-bold mb-4">Additional Simulations</Text>
          <View className="flex-row flex-wrap justify-between">
            {SECONDARY_LABS.map(renderSecondaryLab)}
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

