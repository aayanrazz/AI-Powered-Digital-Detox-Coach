import 'react-native-gesture-handler';
import notifee from '@notifee/react-native';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { handleBackgroundNotificationEvent } from './src/services/notificationService';

notifee.onBackgroundEvent(handleBackgroundNotificationEvent);

AppRegistry.registerComponent(appName, () => App);