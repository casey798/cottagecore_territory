import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { lockPortrait } from './src/hooks/useScreenOrientation';
import { RootNavigator } from './src/navigation/RootNavigator';

function App(): React.JSX.Element {
  useEffect(() => {
    lockPortrait();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar hidden />
      <RootNavigator />
    </GestureHandlerRootView>
  );
}

export default App;
