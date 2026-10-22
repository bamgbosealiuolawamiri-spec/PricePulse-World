export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#10B981',
        deep: '#047857',
        soft: '#ECFDF5',
        ink: '#1F2937',
        mute: '#6B7280'
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
}