import * as FileSystem from 'expo-file-system/legacy';

// AsyncStorage may restore a record containing the old iOS sandbox UUID while
// iOS restores the photo itself into the app's new Documents container.
export async function restoreImageUris(records, folderNames) {
  if (!Array.isArray(records) || !FileSystem.documentDirectory) {
    return { records, changed: false };
  }

  const currentDirectories = new Map();
  await Promise.all(folderNames.map(async folderName => {
    const directory = `${FileSystem.documentDirectory}${folderName}/`;
    try {
      const files = await FileSystem.readDirectoryAsync(directory);
      currentDirectories.set(folderName, new Set(files));
    } catch {
      currentDirectories.set(folderName, new Set());
    }
  }));

  let changed = false;
  const restoredRecords = records.map(record => {
    const uri = record?.imageUri;
    if (typeof uri !== 'string' || !uri) return record;

    for (const folderName of folderNames) {
      const marker = `/${folderName}/`;
      const markerIndex = uri.lastIndexOf(marker);
      if (markerIndex < 0) continue;

      const fileName = decodeURIComponent(uri.slice(markerIndex + marker.length).split(/[?#]/, 1)[0]);
      const currentUri = `${FileSystem.documentDirectory}${folderName}/${fileName}`;
      if (uri === currentUri || !currentDirectories.get(folderName)?.has(fileName)) return record;

      changed = true;
      return { ...record, imageUri: currentUri };
    }

    return record;
  });

  return { records: restoredRecords, changed };
}
