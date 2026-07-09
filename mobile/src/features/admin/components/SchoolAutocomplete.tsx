import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Keyboard } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { apiClient } from '../../../core/api/client';

interface SchoolAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}

export const SchoolAutocomplete: React.FC<SchoolAutocompleteProps> = ({
  value,
  onChange,
  error,
  placeholder = "Enter school name"
}) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const searchSchools = async (searchQuery: string) => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/schools/search?q=${encodeURIComponent(searchQuery)}`);
      setResults(res.data);
      setShowDropdown(true);
    } catch (err) {
      console.error('Failed to search schools', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    setQuery(text);
    onChange(text); // Keep parent state in sync

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (text.trim().length === 0) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      searchSchools(text);
    }, 300);
  };

  const handleSelect = (schoolName: string) => {
    setQuery(schoolName);
    onChange(schoolName);
    setShowDropdown(false);
    Keyboard.dismiss();
  };

  const handleAddNew = async () => {
    if (!query.trim()) return;
    try {
      setLoading(true);
      const res = await apiClient.post('/schools', { name: query.trim() });
      handleSelect(res.data.name);
    } catch (err: any) {
      console.error('Failed to add school', err);
      // If it already exists, just select it
      if (err.response?.status === 400) {
        handleSelect(query.trim());
      }
    } finally {
      setLoading(false);
    }
  };

  const exactMatchExists = results.some(r => r.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <View className="mb-4 z-50">
      <View className={`flex-row items-center bg-slate-800/50 rounded-xl px-4 h-12 border ${error ? 'border-red-500' : 'border-slate-700/50'}`}>
        <MaterialIcons name="school" size={20} color={error ? '#ef4444' : '#94a3b8'} />
        <TextInput
          className="flex-1 ml-3 text-slate-100 font-medium text-sm h-full"
          placeholder={placeholder}
          placeholderTextColor="#64748b"
          value={query}
          onChangeText={handleTextChange}
          onFocus={() => {
            if (query.trim().length > 0) {
              searchSchools(query);
            }
          }}
          onBlur={() => {
             // Delay hiding dropdown so touches on items register
             setTimeout(() => setShowDropdown(false), 200);
          }}
        />
        {loading && <ActivityIndicator size="small" color="#94a3b8" />}
      </View>
      {error && <Text className="text-red-400 text-[10px] mt-1 ml-1">{error}</Text>}

      {showDropdown && query.trim().length > 0 && (
        <View className="absolute top-14 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl max-h-60 overflow-hidden shadow-lg z-50">
          <FlatList
            data={results}
            keyExtractor={item => item.id}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="px-4 py-3 border-b border-slate-700/50 flex-row items-center"
                onPress={() => handleSelect(item.name)}
              >
                <MaterialIcons name="business" size={16} color="#94a3b8" />
                <Text className="text-slate-200 text-sm ml-3 flex-1">{item.name}</Text>
              </TouchableOpacity>
            )}
            ListFooterComponent={
              !exactMatchExists && !loading && query.trim().length > 0 ? (
                <TouchableOpacity
                  className="px-4 py-3 bg-blue-500/10 flex-row items-center"
                  onPress={handleAddNew}
                >
                  <MaterialIcons name="add-circle-outline" size={16} color="#3b82f6" />
                  <Text className="text-blue-400 font-medium text-sm ml-3 flex-1">
                    Add "{query}" as new school
                  </Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </View>
      )}
    </View>
  );
};
