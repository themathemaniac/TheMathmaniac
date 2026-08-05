module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2D8C82",     // Ocean Teal
        secondary: "#5B6EF5",   // Soft Academic Indigo
        darkbg: "#FAFBF8",      // Warm Off-White background
        accent: "#E8E5FF",      // Lavender Mist
        slate: {
          50: '#FFFFFF',        // Card background (pure white)
          100: '#1F2937',       // Primary Text
          200: '#1F2937',
          300: '#1F2937',
          400: '#6B7280',       // Secondary Text
          500: '#6B7280',
          600: '#6B7280',
          700: 'rgba(45, 140, 130, 0.15)', // Subtle Teal Card border
          800: 'rgba(45, 140, 130, 0.12)', // Subtle Teal General border
          900: '#FFFFFF',       // Card / Section background (pure white)
          950: '#FAFBF8',       // Page background (warm off-white)
        },
        blue: {
          50: '#FAFBF8',
          100: '#E6F4F1',
          200: '#CCECEA',
          300: '#99DAD4',
          400: '#2D8C82',
          500: '#2D8C82',       // Ocean Teal
          600: '#2D8C82',       // Ocean Teal
          700: '#247068',
          800: '#1B544E',
          900: '#123834',
        },
        emerald: {
          50: '#EEF2F6',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#5B6EF5',       // Soft Academic Indigo
          500: '#5B6EF5',       // Soft Academic Indigo
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        }
      },
      fontFamily: {
        sans: ['Poppins_400Regular'],
        poppins: ['Poppins_400Regular'],
      }
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.font-light': { fontWeight: '300', fontFamily: 'Poppins_300Light' },
        '.font-normal': { fontWeight: '400', fontFamily: 'Poppins_400Regular' },
        '.font-medium': { fontWeight: '500', fontFamily: 'Poppins_500Medium' },
        '.font-semibold': { fontWeight: '600', fontFamily: 'Poppins_600SemiBold' },
        '.font-bold': { fontWeight: '700', fontFamily: 'Poppins_700Bold' },
        '.font-extrabold': { fontWeight: '800', fontFamily: 'Poppins_800ExtraBold' },
        '.font-black': { fontWeight: '900', fontFamily: 'Poppins_900Black' },
      });
    }
  ],
}
