import { useCallback, useEffect, useRef } from 'react';
import { Keyboard } from 'react-native';

// Tab screens stay mounted: reset search on an actual navigation blur.
export default function useFoodSearchInput({ navigation, inputRef, query, setQuery, setSearching }) {
  const queryRef = useRef(query);
  queryRef.current = query;
  const selectionFrame = useRef(null);
  const cancelSelection = useCallback(() => {
    if (selectionFrame.current !== null) cancelAnimationFrame(selectionFrame.current);
    selectionFrame.current = null;
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      cancelSelection();
      inputRef.current?.blur();
      setQuery('');
      setSearching(false);
      navigation.setParams({ openSearch: undefined });
      Keyboard.dismiss();
    });
    return () => { unsubscribe(); cancelSelection(); };
  }, [navigation, inputRef, setQuery, setSearching, cancelSelection]);

  const selectAll = useCallback(() => {
    cancelSelection();
    // Native touch handling can place the caret after onFocus; select after it.
    selectionFrame.current = requestAnimationFrame(() => {
      selectionFrame.current = null;
      inputRef.current?.setNativeProps({ selection: { start: 0, end: queryRef.current.length } });
    });
  }, [inputRef, cancelSelection]);

  const blurInput = useCallback(() => {
    cancelSelection();
    inputRef.current?.blur();
    Keyboard.dismiss();
  }, [inputRef, cancelSelection]);

  return { selectAll, blurInput };
}
