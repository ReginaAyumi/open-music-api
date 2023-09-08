const fs = require('fs');
const autoBind = require('auto-bind');
const { Pool } = require('pg');

class StorageService {
  constructor(folder, service) {
    this._folder = folder;
    this._service = service;
    this._pool = new Pool();

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    autoBind(this);
  }

  writeFile(file, meta) {
    const filename = +new Date() + meta.filename;
    const path = `${this._folder}/${filename}`;

    const fileStream = fs.createWriteStream(path);

    return new Promise((resolve, reject) => {
      fileStream.on('error', (error) => reject(error));
      file.pipe(fileStream);
      file.on('end', () => resolve(filename));
    });
  }

  async addAlbumCover(coverUrl, id) {
    const query = {
      text: 'UPDATE albums SET cover_url = $1 WHERE id = $2 RETURNING id',
      values: [coverUrl, id],
    };
    await this._pool.query(query);
  }
}

module.exports = StorageService;