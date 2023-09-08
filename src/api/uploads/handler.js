const autoBind = require('auto-bind');
const config = require('../../utils/config');

class UploadsHandler {
  constructor(service, validator) {
    this._service = service;
    this._validator = validator;

    autoBind(this);
  }

  async postUploadCoverImageHandler(request, h) {
    const { cover } = request.payload;
    const { id } = request.params;
    this._validator.validateImageHeaders(cover.hapi.headers);

    const filename = await this._service.writeFile(cover, cover.hapi);
    const coverUrl = `http://${config.app.host}:${config.app.port}/uploads/images/${filename}`;
    await this._service.addAlbumCover(coverUrl, id);

    const response = h.response({
      status: 'success',
      message: 'Cover berhasil diunggah',
    });
    response.code(201);
    return response;
  }
}

module.exports = UploadsHandler;