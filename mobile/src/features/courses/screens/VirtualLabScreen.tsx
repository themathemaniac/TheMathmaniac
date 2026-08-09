import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigation/types';

// Placeholder lab data (to be updated later)
const LABS = [
  {
    id: '1',
    title: 'Physics Mechanics Lab',
    description: 'Interactive simulations for kinematics and dynamics.',
    url: 'https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_en.html',
    icon: '⚛️',
    color: 'bg-blue-500/20',
    borderColor: 'border-blue-500/40',
    textColor: 'text-blue-400'
  },
  {
    id: '2',
    title: 'Chemistry Titration',
    description: 'Virtual acid-base titration experiments.',
    url: 'https://phet.colorado.edu/sims/html/acid-base-solutions/latest/acid-base-solutions_en.html',
    icon: '🧪',
    color: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/40',
    textColor: 'text-emerald-400'
  },
  {
    id: '3',
    title: 'Circuit Builder',
    description: 'Build and test electrical circuits safely.',
    url: 'https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc_en.html',
    icon: '⚡',
    color: 'bg-amber-500/20',
    borderColor: 'border-amber-500/40',
    textColor: 'text-amber-400'
  },
  {
    id: '4',
    title: 'Biology Microscopy',
    description: 'Explore cells under a virtual microscope.',
    url: 'https://www.ncbionetwork.org/iet/microscope/',
    icon: '🔬',
    color: 'bg-purple-500/20',
    borderColor: 'border-purple-500/40',
    textColor: 'text-purple-400'
  }
];

export const VirtualLabScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

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
        <View className="flex-row flex-wrap justify-between">
          {LABS.map((lab) => (
            <TouchableOpacity
              key={lab.id}
              className={`w-[48%] rounded-3xl p-5 mb-4 border ${lab.borderColor} ${lab.color} active:opacity-70`}
              onPress={() => navigation.navigate('LabWebView', { url: lab.url, title: lab.title })}
            >
              <View className="w-12 h-12 rounded-full bg-slate-900/50 justify-center items-center mb-4">
                <Text className="text-2xl">{lab.icon}</Text>
              </View>
              <Text className="text-slate-100 font-bold text-sm mb-1">{lab.title}</Text>
              <Text className={`text-[10px] font-medium ${lab.textColor}`}>{lab.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};
