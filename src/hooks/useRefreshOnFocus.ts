import React from 'react';
import { useFocusEffect } from '@react-navigation/native';

export function useRefreshOnFocus(
  refresh: () => Promise<void> | void
) {
  useFocusEffect(
    React.useCallback(() => {
      void refresh();
      return undefined;
    }, [refresh])
  );
}