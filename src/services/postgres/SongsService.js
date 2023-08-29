/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-underscore-dangle */
const { Pool } = require('pg');
const { nanoid } = require('nanoid');
const InvariantError = require('../../exceptions/invariantError');
const NotFoundError = require('../../exceptions/notFoundError');
const { mapDBToSongsModel } = require('../../utils');

class SongsService {
  constructor() {
    this._pool = new Pool();
  }

  async addSong({
    title,
    year,
    genre,
    performer,
    duration,
    albumId,
  }) {
    const id = `song-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO songs VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      values: [id, title, year, genre, performer, duration, albumId],
    };

    const result = await this._pool.query(query);

    if (!result.rows[0].id) {
      throw new InvariantError('Gagal emnambahkan lagu');
    }

    return result.rows[0].id;
  }

  async getSongs(title, performer) {
    const query = {
      text:
      'SELECT id, title, performer FROM songs WHERE LOWER(title) LIKE $1 OR LOWER(performer) LIKE $2',
      values:
      [
        `%${title ? title.toLowerCase() : ''}%`,
        `%${performer ? performer.toLowerCase() : ''}%`,
      ],
    };

    const result = await this._pool.query(query);
    return result.rows.map(mapDBToSongsModel);
  }

  async getSongsByAlbumId(id) {
    const query = {
      text: 'SELECT * FROM songs WHERE album_id = $1',
      values: [id],
    };

    const result = await this._pool.query(query);
    return result.rows.map(mapDBToSongsModel);
  }

  async getSongById(id) {
    const query = {
      text: 'SELECT * FROM songs WHERE id = $1',
      values: [id],
    };

    const result = await this._pool.query(query);
    if (!result.rows.length) {
      throw new NotFoundError('Lagu tidak ditemukan');
    }

    return result.rows.map(mapDBToSongsModel)[0];
  }

  async editSongById(id, {
    title,
    year,
    genre,
    performer,
    duration,
    albumId,
  }) {
    const query = {
      text: 'UPDATE songs SET title = $1, year = $2, genre = $3, performer = $4, duration = $5, album_id = $6 WHERE id = $7 RETURNING id',
      values: [title, year, genre, performer, duration, albumId, id],
    };

    const result = await this._pool.query(query);
    if (!result.rows.length) {
      throw new NotFoundError('Gagal memperbarui lagu. Id tidak ditemukan');
    }
  }

  async deleteSongById(id) {
    const query = {
      text: 'DELETE FROM songs WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);
    if (!result.rows.length) {
      throw new NotFoundError('Gagal menghapus lagu. Id tidak ditemukan');
    }
  }
}

module.exports = SongsService;
