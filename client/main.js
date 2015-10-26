Accounts.ui.config({
  passwordSignupFields: "USERNAME_ONLY"
});

Pieces = {};
PiecesHandle = {};
LocalPieces = new Mongo.Collection(null);

Connections = {};

// var lists = [
//   {server: "piece.meteor.com", userId: [
//     "hocm8Cd3SjztwtiBr",
//     "492WZqeqCxrDqfG5u"
//   ]},
//   {server: "localhost:4000", userId: [
//     "X3oicwXho45xzmyc6",
//     "iZY4CdELFN9eQv5sa"
//   ]}
// ];

var connect = function (lists) {
  console.log("subs:", lists);
  _.each(lists, function (list) {
    console.log("connect:", list.server, list.userId);
    Connections[`${list.server}`] = DDP.connect(`http://${list.server}`);
    Pieces[`${list.server}`] = new Mongo.Collection('pieces', {connection: Connections[`${list.server}`]});
    PiecesHandle[`${list.server}`] = Connections[`${list.server}`].subscribe("pieceMultiUserPosts", list.userId);
  });
};

var observe = function () {
  console.log("observation begins");
  _.each(PiecesHandle, function (handle, server) {
    Tracker.autorun(function () {
      if (handle.ready()) {
        console.log("subscribe of", server, handle.ready());
        let cursor = Pieces[server].find();
        let cursorHandle = cursor.observeChanges({
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

Template.app.onCreated(function () {
  this.subscribe('pieceCurrentUserSubs');
  console.log('subscribe pieceCurrentUserSubs');
});

Template.cards.onCreated(function () {
  console.log('cards rendered')
  let listsCursor = Subs.find({ownerId: Meteor.userId()});
  let lists = listsCursor.fetch();
  connect(lists);
  observe();
});

Template.cards.helpers({
  cards: function () {
    return LocalPieces.find({}, {sort: {createdAt: -1}});
  }
});

Template.form.events({
  'submit form': function (event, template) {
    event.preventDefault();
    let server = event.target.server.value;
    let userId = event.target.userId.value;

    if (! Meteor.userId()) {
      throw new Meteor.Error("not-authorized", "Log in before subscribe.");
    }

    if (! Connections[`${server}`]) {
      console.log("connect:", server, userId);
      Connections[`${server}`] = DDP.connect(`http://${server}`);
      Pieces[`${server}`] = new Mongo.Collection('pieces', {connection: Connections[`${server}`]});
      PiecesHandle[`${server}`] = Connections[`${server}`].subscribe("pieceSingleUserPosts", userId);

      Tracker.autorun(function () {
        if (PiecesHandle[`${server}`].ready()) {
          console.log("subscribe of", server, PiecesHandle[`${server}`].ready());
          let cursor = Pieces[server].find();
          let cursorHandle = cursor.observeChanges({
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
    } else {
      Connections[`${server}`].subscribe("pieceSingleUserPosts", userId);
    }

    Meteor.call('subInsert', server, userId);

    event.target.server.value = '';
    event.target.userId.value = '';
  }
});
