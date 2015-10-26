Accounts.ui.config({
  passwordSignupFields: "USERNAME_ONLY"
});

Connections = {};
Collections = {};
Subscriptions = {};

Pieces = new Mongo.Collection(null); // Local collection

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

var connect = function (server, userId) {
  console.log("connect:", server, userId);
  Connections[server] = DDP.connect(`http://${server}`);
  Collections[server] = new Mongo.Collection('pieces', {connection: Connections[server]});
  if (userId.constructor === Array) {
    Subscriptions[server] = Connections[server].subscribe("pieceMultiUserPosts", userId);
  } else {
    Subscriptions[server] = Connections[server].subscribe("pieceSingleUserPosts", userId);
  }
};

var observe = function (handle, server) {
  Tracker.autorun(function () {
    if (handle.ready()) {
      console.log("subscription from", server, "is ready");
      let cursor = Collections[server].find();
      let cursorHandle = cursor.observeChanges({
        added: function (id, piece) {
          console.log("added:", id, piece);
          piece._id = id;
          Pieces.insert(piece);
        },
        removed: function (id) {
          console.log("removed:", id);
          Pieces.remove(id);
        }
      });
    }
  })
}

Template.app.onCreated(function () {
  this.subscribe('pieceCurrentUserSubs');
  console.log('subscribed pieceCurrentUserSubs publication');
});

Template.cards.onCreated(function () {
  console.log('created cards template')
  let listsCursor = Subs.find();
  let lists = listsCursor.fetch();

  console.log("subs:", lists);
  _.each(lists, function (list) {
    connect(list.server, list.userId);
  });

  console.log("observation begins");
  _.each(Subscriptions, function (handle, server) {
    observe(handle, server);
  });
});

Template.cards.helpers({
  cards: function () {
    return Pieces.find({}, {sort: {createdAt: -1}});
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

    if (! Connections[server]) {
      connect(server, userId);
      observe(Subscriptions[server], server);
    } else {
      Connections[server].subscribe("pieceSingleUserPosts", userId);
    }

    Meteor.call('subInsert', server, userId);

    event.target.server.value = '';
    event.target.userId.value = '';
  }
});
