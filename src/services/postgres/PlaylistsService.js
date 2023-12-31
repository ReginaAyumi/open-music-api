const { nanoid } = require('nanoid');
const { Pool } = require('pg');
const InvariantError = require('../../exceptions/invariantError');
const NotFoundError = require('../../exceptions/notFoundError');
const AuthorizationError = require('../../exceptions/authorizationError');

class PlaylistsService {
  constructor(collaborationsService, cacheService) {
    this._pool = new Pool();
    this._collaborationsService = collaborationsService;
    this._cacheService = cacheService;
  }

  async addPlaylist({ name, owner }) {
    const id = `playlist-${nanoid(16)}`;

    const query = {
      text: 'INSERT INTO playlists VALUES($1, $2, $3) RETURNING id',
      values: [id, name, owner],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new InvariantError('Playlist gagal ditambahkan');
    }

    await this._cacheService.delete(`playlists:${owner}`);

    return result.rows[0].id;
  }

  async getPlaylists(owner) {
    try {
      const result = await this._cacheService.get(`playlists:${owner}`);
      return JSON.parse(result);
    } catch (error) {
      const query = {
        text: 'SELECT pl.id, pl.name, us.username FROM playlists AS pl INNER JOIN users AS us ON pl.owner = us.id WHERE pl.owner = $1 UNION SELECT pl.id, pl.name, us.username FROM collaborations AS cl INNER JOIN playlists AS pl ON cl.playlist_id = pl.id INNER JOIN users us ON pl.owner = us.id WHERE cl.user_id = $1',
        values: [owner],
      };

      const result = await this._pool.query(query);
      const getPlaylists = result.rows;

      await this._cacheService.set(`playlists:${owner}`, JSON.stringify(getPlaylists));

      return getPlaylists;
    }
  }

  async getPlaylistById(playlistId) {
    const query = {
      text: 'SELECT * FROM playlists WHERE id = $1',
      values: [playlistId],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Playlist tidak ditemukan');
    }

    return result.rows[0];
  }

  async deletePlaylistById(id) {
    const query = {
      text: 'DELETE FROM playlists WHERE id = $1 RETURNING id',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Playlist gagal dihapus. Id tidak ditemukan');
    }
  }

  async addSongToPlaylist(playlistId, songId) {
    const id = `song_playlist-${nanoid(16)}`;
    const query = {
      text: 'INSERT INTO playlist_songs VALUES ($1, $2, $3) RETURNING id',
      values: [id, playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new InvariantError('Musik gagal ditambahkan kedalam playlist');
    }

    await this._cacheService.delete(`playlistSongs:${playlistId}`);
  }

  async getPlaylistSongsById(playlistId, userId) {
    await this.verifyPlaylistAccess(playlistId, userId);

    try {
      const result = await this._cacheService.get(`playlistSongs:${playlistId}`);
      return JSON.parse(result);
    } catch (error) {
      const queryGetPlaylist = {
        text: 'SELECT pl.id, pl.name, us.username FROM playlists pl INNER JOIN users us ON pl.owner = us.id WHERE pl.id = $1',
        values: [playlistId],
      };
      const queryGetSongs = {
        text: 'SELECT s.id, s.title, s.performer FROM songs s INNER JOIN playlist_songs pl  ON pl.song_id = s.id WHERE pl.playlist_id = $1',
        values: [playlistId],
      };

      const playlistResult = await this._pool.query(queryGetPlaylist);
      const songsResult = await this._pool.query(queryGetSongs);

      if (!playlistResult.rowCount) {
        throw new NotFoundError('Playlist tidak ditemukan');
      }

      const data = playlistResult.rows[0];
      data.songs = songsResult.rows;
      const result = playlistResult.rows[0];

      await this._cacheService.set(`playlistSongs:${playlistId}`, JSON.stringify(result));

      return result;
    }
  }

  async deleteSongFromPlaylist(playlistId, songId) {
    const query = {
      text: `DELETE FROM playlist_songs 
      WHERE playlist_id = $1 AND song_id = $2
      RETURNING id`,
      values: [playlistId, songId],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new InvariantError('Musik gagal dihapus dari playlist');
    }

    await this._cacheService.delete(`playlistSongs:${playlistId}`);
  }

  async getPlaylistActivitiesById(playlistId) {
    await this.getPlaylistById(playlistId);

    try {
      const result = await this._cacheService.get(`playlistActivities:${playlistId}`);
      return JSON.parse(result);
    } catch (error) {
      const query = {
        text: `SELECT us.username, s.title, act.action, act.time
        FROM playlist_song_activities act
        INNER JOIN songs s
        ON act.song_id = s.id
        INNER JOIN users us
        ON act.user_id = us.id
        WHERE playlist_id = $1
        ORDER BY act.time ASC`,
        values: [playlistId],
      };

      const result = await this._pool.query(query);
      const playlistActivies = result.rows;

      // aktivitas playlist akan disimpan pada cache sebelum fungsi dikembalikan
      await this._cacheService.set(`playlistActivities:${playlistId}`, JSON.stringify(playlistActivies));

      return playlistActivies;
    }
  }

  async addActivity(playlistId, songId, userId, action) {
    const id = `activity-${nanoid(16)}`;
    const time = new Date().toISOString();
    const query = {
      text: `INSERT INTO playlist_song_activities
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id`,
      values: [id, playlistId, songId, userId, action, time],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new InvariantError('Gagal menambahkan activity');
    }

    await this._cacheService.delete(`playlistActivities:${playlistId}`);
  }

  async verifyPlaylistOwner(id, userId) {
    const query = {
      text: 'SELECT * FROM playlists WHERE id = $1',
      values: [id],
    };

    const result = await this._pool.query(query);

    if (!result.rowCount) {
      throw new NotFoundError('Playlist tidak ditemukan');
    }

    const playlist = result.rows[0];

    if (playlist.owner !== userId) {
      throw new AuthorizationError('Anda tidak berhak mengakses resource ini');
    }
  }

  async verifyPlaylistAccess(playlistId, userId) {
    try {
      await this.verifyPlaylistOwner(playlistId, userId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      try {
        await this._collaborationsService.verifyCollaborator(playlistId, userId);
      } catch {
        throw error;
      }
    }
  }
}

module.exports = PlaylistsService;
