import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ch.hubbing.app',
  appName: 'Hubbing',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  }
};

export default config;