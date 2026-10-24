import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.pricepulse.world',
  appName: 'PricePulse World',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
}

export default config
