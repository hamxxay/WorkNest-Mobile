/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Push messages that arrive while the app is in the background or closed. Must be registered before
// the app component. Android shows the notification itself; a tap opens the app through the deep-link
// config (src/navigation/linking.ts), and announcements are reloaded from the API when the app opens.
try {
  setBackgroundMessageHandler(getMessaging(), async () => undefined);
} catch (error) {
  if (__DEV__) console.warn('[push] background handler not registered', error);
}

AppRegistry.registerComponent(appName, () => App);
