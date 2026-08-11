import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

type LabItem = {
  id: string;
  title: string;
  url: string;
  redirectUrl?: string;
  gravitonLabTitle?: string;
  icon: string;
  color: string;
  borderColor: string;
  textColor: string;
};

const ALCHEMAX_LABS: LabItem[] = [
  { id: 'a1', title: '3D Viewer', url: 'https://alchemax-inky.vercel.app/', redirectUrl: 'https://alchemax-inky.vercel.app/workspace/viewer', icon: '🧪', color: 'bg-indigo-500/20', borderColor: 'border-indigo-500/50', textColor: 'text-indigo-400' },
  { id: 'a2', title: 'Reactions', url: 'https://alchemax-inky.vercel.app/', redirectUrl: 'https://alchemax-inky.vercel.app/workspace/reactions', icon: '🔥', color: 'bg-indigo-500/20', borderColor: 'border-indigo-500/50', textColor: 'text-indigo-400' },
  { id: 'a3', title: 'Calculators', url: 'https://alchemax-inky.vercel.app/', redirectUrl: 'https://alchemax-inky.vercel.app/workspace/calculators', icon: '🧮', color: 'bg-indigo-500/20', borderColor: 'border-indigo-500/50', textColor: 'text-indigo-400' },
  { id: 'a4', title: 'Periodic Table', url: 'https://alchemax-inky.vercel.app/', redirectUrl: 'https://alchemax-inky.vercel.app/workspace/periodic-table', icon: '📊', color: 'bg-indigo-500/20', borderColor: 'border-indigo-500/50', textColor: 'text-indigo-400' },
  { id: 'a5', title: 'Compounds', url: 'https://alchemax-inky.vercel.app/', redirectUrl: 'https://alchemax-inky.vercel.app/workspace/compounds', icon: '⚗️', color: 'bg-indigo-500/20', borderColor: 'border-indigo-500/50', textColor: 'text-indigo-400' },
  { id: 'a6', title: 'Isomers Explorer', url: 'https://alchemax-inky.vercel.app/', redirectUrl: 'https://alchemax-inky.vercel.app/workspace/isomers', icon: '🧬', color: 'bg-indigo-500/20', borderColor: 'border-indigo-500/50', textColor: 'text-indigo-400' },
  { id: 'a7', title: 'Reaction Mechanisms', url: 'https://alchemax-inky.vercel.app/', redirectUrl: 'https://alchemax-inky.vercel.app/workspace/mechanisms', icon: '⚙️', color: 'bg-indigo-500/20', borderColor: 'border-indigo-500/50', textColor: 'text-indigo-400' },
  { id: 'a8', title: 'Electronic Effects', url: 'https://alchemax-inky.vercel.app/', redirectUrl: 'https://alchemax-inky.vercel.app/workspace/effects', icon: '⚡', color: 'bg-indigo-500/20', borderColor: 'border-indigo-500/50', textColor: 'text-indigo-400' },
  { id: 'a9', title: 'Electronegativity Visualiser', url: 'https://alchemax-inky.vercel.app/', redirectUrl: 'https://alchemax-inky.vercel.app/workspace/visualiser', icon: '👁️', color: 'bg-indigo-500/20', borderColor: 'border-indigo-500/50', textColor: 'text-indigo-400' },
  { id: 'a10', title: 'Bonds & Forces', url: 'https://alchemax-inky.vercel.app/', redirectUrl: 'https://alchemax-inky.vercel.app/workspace/bonds', icon: '🔗', color: 'bg-indigo-500/20', borderColor: 'border-indigo-500/50', textColor: 'text-indigo-400' }
];

const GRAVITON_LABS: LabItem[] = [
  { id: 'g1', title: 'Free Fall & Air Resistance', gravitonLabTitle: 'Free Fall & Air Resistance', url: 'https://graviton-gamma.vercel.app/', icon: '🪂', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g2', title: 'Universal Motion Simulator', gravitonLabTitle: 'Universal Motion Simulator', url: 'https://graviton-gamma.vercel.app/', icon: '🚀', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g3', title: 'Friction on Inclined Plane', gravitonLabTitle: 'Friction on Inclined Plane', url: 'https://graviton-gamma.vercel.app/', icon: '📐', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g4', title: 'Pendulum Motion', gravitonLabTitle: 'Pendulum Motion', url: 'https://graviton-gamma.vercel.app/', icon: '⏱️', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g5', title: 'Circular Motion', gravitonLabTitle: 'Circular Motion', url: 'https://graviton-gamma.vercel.app/', icon: '🔄', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g6', title: 'Spring-Mass Oscillator', gravitonLabTitle: 'Spring-Mass Oscillator', url: 'https://graviton-gamma.vercel.app/', icon: '〰️', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g7', title: 'Projectile Motion', gravitonLabTitle: 'Projectile Motion', url: 'https://graviton-gamma.vercel.app/', icon: '☄️', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g8', title: 'Collisions & Momentum', gravitonLabTitle: 'Collisions & Momentum', url: 'https://graviton-gamma.vercel.app/', icon: '💥', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g9', title: 'Ray Optics & Lenses', gravitonLabTitle: 'Ray Optics & Lenses', url: 'https://graviton-gamma.vercel.app/', icon: '🔍', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g10', title: 'Lateral Inversion', gravitonLabTitle: 'Lateral Inversion', url: 'https://graviton-gamma.vercel.app/', icon: '🪞', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g11', title: 'Critical Angle & TIR', gravitonLabTitle: 'Critical Angle & TIR', url: 'https://graviton-gamma.vercel.app/', icon: '💎', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g12', title: 'Wave Interference', gravitonLabTitle: 'Wave Interference', url: 'https://graviton-gamma.vercel.app/', icon: '🌊', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g13', title: 'AC Circuit & Resonance', gravitonLabTitle: 'AC Circuit & Resonance', url: 'https://graviton-gamma.vercel.app/', icon: '⚡', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g14', title: 'Magnetic Field & Lorentz Force', gravitonLabTitle: 'Magnetic Field & Lorentz Force', url: 'https://graviton-gamma.vercel.app/', icon: '🧲', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g15', title: 'Gas Laws & Thermodynamics', gravitonLabTitle: 'Gas Laws & Thermodynamics', url: 'https://graviton-gamma.vercel.app/', icon: '🌡️', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g16', title: 'Photoelectric Effect', gravitonLabTitle: 'Photoelectric Effect', url: 'https://graviton-gamma.vercel.app/', icon: '☀️', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g17', title: 'Alpha Radiation Decay', gravitonLabTitle: 'Alpha Radiation Decay', url: 'https://graviton-gamma.vercel.app/', icon: 'α', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g18', title: 'Beta Radiation Decay', gravitonLabTitle: 'Beta Radiation Decay', url: 'https://graviton-gamma.vercel.app/', icon: 'β', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' },
  { id: 'g19', title: 'Gamma Radiation', gravitonLabTitle: 'Gamma Radiation', url: 'https://graviton-gamma.vercel.app/', icon: 'γ', color: 'bg-fuchsia-500/20', borderColor: 'border-fuchsia-500/50', textColor: 'text-fuchsia-400' }
];

export const VirtualLabScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const renderLabTile = (lab: LabItem) => (
    <TouchableOpacity
      key={lab.id}
      className={`w-[48%] rounded-2xl p-4 mb-4 border ${lab.borderColor} ${lab.color} active:opacity-70`}
      onPress={() => navigation.navigate('LabWebView', { 
        url: lab.url, 
        title: lab.title,
        redirectUrl: lab.redirectUrl,
        gravitonLabTitle: lab.gravitonLabTitle
      })}
    >
      <View className="w-10 h-10 rounded-full bg-slate-900/30 justify-center items-center mb-3">
        <Text className="text-xl">{lab.icon}</Text>
      </View>
      <Text className="text-slate-100 font-bold text-sm mb-1" numberOfLines={1}>{lab.title}</Text>
      <Text className={`text-[10px] font-medium ${lab.textColor}`} numberOfLines={2}>Interactive Simulation</Text>
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
          <Text className="text-white text-lg font-bold mb-4">Chemistry Labs (Alchemax)</Text>
          <View className="flex-row flex-wrap justify-between">
            {ALCHEMAX_LABS.map(renderLabTile)}
          </View>
        </View>

        <View className="mb-2">
          <View className="h-[1px] bg-slate-800 w-full mb-6" />
          <Text className="text-slate-300 text-sm font-bold mb-4">Physics Simulations (Graviton)</Text>
          <View className="flex-row flex-wrap justify-between">
            {GRAVITON_LABS.map(renderLabTile)}
          </View>
        </View>

      </ScrollView>
    </View>
  );
};
