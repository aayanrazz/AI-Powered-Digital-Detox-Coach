import React from 'react';
import { useFocusEffect } from '@react-navigation/native';

export function useRefreshOnFocus(refresh: () => Promise<void> | void) {
  const refreshRef = React.useRef(refresh);

  React.useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useFocusEffect(
    React.useCallback(() => {
      Promise.resolve(refreshRef.current()).catch(() => {
        // each screen already owns its own error handling
      });
      return undefined;
    }, [])
  );
}