const options = {
  format: (value, type) => {
    if (type === 'url' && value.length > 50) {
      value = value.slice(0, 50) + '…';
    }
    return value;
  },
  linkAttributes: {
    rel: 'nofollow'
  },
  linkClass: null
};

Template.pieceTypeIsPlaintext.onRendered(function () {
  const instance = this;
  instance.$('p.js-content').linkify(options);
})

Template.pieceTypeIsSharismPiece.onRendered(function () {
  const instance = this;
  instance.$('p.js-content').linkify(options);
})

Template.previewPieceTypeIsPlaintext.onRendered(function () {
  const instance = this;
  instance.$('span.js-content').linkify(options);
})
Template.previewPieceTypeIsSharismPiece.onRendered(function () {
  const instance = this;
  instance.$('span.js-content').linkify(options);
})
