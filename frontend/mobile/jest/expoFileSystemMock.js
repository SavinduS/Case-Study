// Minimal expo-file-system mock (File used by api/client; size/info and
// legacy getInfoAsync used by services/validatePhoto). File sizes are
// controllable per URI so photo validation can be tested.
const fileSizes = new Map();

class File {
  constructor(uri) {
    this.uri = uri;
  }
  get size() {
    const entry = fileSizes.get(this.uri);
    return typeof entry === 'number' ? entry : null;
  }
  info() {
    const entry = fileSizes.get(this.uri);
    return typeof entry === 'number' ? { size: entry } : null;
  }
  async bytes() {
    return new Uint8Array([1, 2, 3]);
  }
}

async function getInfoAsync(uri) {
  const entry = fileSizes.get(uri);
  return typeof entry === 'number' ? { size: entry } : null;
}

module.exports = {
  File,
  getInfoAsync,
  __setFileSize: (uri, bytes) => {
    fileSizes.set(uri, bytes);
  },
  __reset: () => {
    fileSizes.clear();
  }
};
