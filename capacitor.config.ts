import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.correlogo.app',
  appName: 'Corre Logo',
  webDir: 'dist',
  // No server config - let Capacitor load from local assets by default
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config',
      iconColor: '#F97316',
    },
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ["google.com"],
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
