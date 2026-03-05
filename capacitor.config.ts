import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ibbra.bpo',
  appName: 'BPO Ibbra',
  webDir: 'dist',
  android: {
    backgroundColor: '#011E41',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    backgroundColor: '#011E41',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#011E41',
      showSpinner: false,
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    Haptics: {
      enabled: true,
    },
  },
};

export default config;
