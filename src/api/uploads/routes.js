const path = require('path');

const routes = (handler) => [
  {
    method: 'POST',
    path: '/albums/{id}/covers',
    handler: handler.postUploadCoverImageHandler,
    options: {
      payload: {
        allow: 'multipart/form-data',
        multipart: true,
        output: 'stream',
        maxBytes: 512000,
      },
    },
  },
  {
    method: 'GET',
    path: '/uploads/{params*}',
    handler: {
      directory: {
        path: path.resolve(__dirname, 'file'),
      },
    },
  },
];

module.exports = routes;