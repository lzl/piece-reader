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

Template.cards.onDestroyed(function () {
  Connections = {};
  Collections = {};
  Subscriptions = {};
  Pieces.remove({});
});

Template.demo.onDestroyed(function () {
  Connections = {};
  Collections = {};
  Subscriptions = {};
  Pieces.remove({});
});

Template.cards.helpers({
  cards() {
    return Pieces.find({}, {sort: {createdAt: -1}});
  }
});

Template.demo.helpers({
  cards() {
    return Pieces.find({}, {sort: {createdAt: -1}});
  }
});

Template.form.onRendered(function () {
  $("#subscribe").validate({
    rules: {
      url: {
        required: true,
        url: true
      },
      userId: {
        required: true,
        rangelength: [17, 17]
      }
    },
    messages: {
      userId: {
        rangelength: "Please enter a valid user ID."
      }
    }
  });
});

// via http://jsperf.com/url-parsing
var urlParse = function (url) {
  let urlParseRE = /^(((([^:\/#\?]+:)?(?:(\/\/)((?:(([^:@\/#\?]+)(?:\:([^:@\/#\?]+))?)@)?(([^:\/#\?\]\[]+|\[[^\/\]@#?]+\])(?:\:([0-9]+))?))?)?)?((\/?(?:[^\/\?#]+\/+)*)([^\?#]*)))?(\?[^#]+)?)(#.*)?/;
  let matches = urlParseRE.exec(url);
  let server = matches[10];
  if (server === undefined) {
    throw new Meteor.Error("undefined", "Server name is undefined.");
  } else {
    return server;
  }
}

var subscribeViaForm = function (server, userId) {
  if (! Connections[server]) {
    connect(server, userId);
    observe(Subscriptions[server], server);
  } else {
    Connections[server].subscribe("pieceSingleUserPosts", userId);
  }
}

Template.form.events({
  'submit form': function (event, template) {
    event.preventDefault();
    let url = template.find("[name='url']").value;
    let server = urlParse(url).toLowerCase();
    let userId = template.find("[name='userId']").value;

    subscribeViaForm(server, userId);

    if (Meteor.userId()) {
      Meteor.call('subInsert', server, userId);
      console.log("sub inserted:", server, userId);
    }

    document.getElementById("subscribe").reset();
  }
});

Template.hero.onCreated(function () {
  let instance = this;
  instance.subscribed = new ReactiveVar(false);
});

Template.hero.helpers({
  subscribed() {
    return Template.instance().subscribed.get();
  }
})

Template.hero.events({
  'click [data-action=subscribe]': function (event, template) {
    event.preventDefault();
    let server = "piece.meteor.com";
    let userId = "492WZqeqCxrDqfG5u";
    subscribeViaForm(server, userId);
    template.subscribed.set(true);
  }
});
