// Minimal expo-file-system mock (only File used by api/client).
class File {
  constructor(uri) {
    this.uri = uri;
  }
  async bytes() {
    return new Uint8Array([1, 2, 3]);
  }
}

module.exports = { File };
