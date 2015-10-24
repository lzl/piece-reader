Pieces = {};
PiecesHandle = {};
LocalPieces = new Mongo.Collection(null);

var lists = [
  {server: "piece.meteor.com", userId: [
    "hocm8Cd3SjztwtiBr",
    "492WZqeqCxrDqfG5u"
  ]},
  {server: "localhost:4000", userId: [
    "X3oicwXho45xzmyc6",
    "iZY4CdELFN9eQv5sa"
  ]}
];

var connect = function () {
  _.each(lists, function (list) {
    console.log("connect:", list.server, list.userId);
    var connection = DDP.connect(`http://${list.server}`);
    Pieces[`${list.server}`] = new Mongo.Collection('pieces', {connection: connection});
    PiecesHandle[`${list.server}`] = connection.subscribe("pieceMultiUserPosts", list.userId);
  });
};

var observe = function () {
  _.each(PiecesHandle, function (handle, server) {
    Tracker.autorun(function () {
      if (handle.ready()) {
        console.log(server, handle.ready());
        var cursor = Pieces[server].find();
        var cursorHandle = cursor.observeChanges({
          added: function (id, piece) {
            console.log("added:", id, piece);
            piece._id = id;
            LocalPieces.insert(piece);
          },
          removed: function (id) {
            console.log("removed:", id);
            LocalPieces.remove(id);
          }
        });
      }
    })
  });
}

Template.cards.onCreated(function () {
  connect();
});

Template.cards.helpers({
  cards: function () {
    observe();
    return LocalPieces.find({}, {sort: {createdAt: -1}});
  }
});
