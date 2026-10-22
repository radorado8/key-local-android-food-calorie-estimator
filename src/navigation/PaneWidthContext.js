import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

export const PaneWidthContext = createContext(null);
export const PaneVisibleContext = createContext(false);
export function usePaneWidth() {
  const width = useContext(PaneWidthContext);
  const window = useWindowDimensions();
  return width > 0 ? width : window.width;
}
