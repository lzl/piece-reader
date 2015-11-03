Accounts.ui.config({
  passwordSignupFields: "USERNAME_ONLY"
});

var reset = function () {
  Connections = Object.create(null);
  Collections = Object.create(null);
  Subscriptions = Object.create(null);
};

reset();
Pieces = new Mongo.Collection(null); // Local collection

// var lists = [
//   {hostname: "piece.meteor.com", userId: [
//     "hocm8Cd3SjztwtiBr",
//     "492WZqeqCxrDqfG5u"
//   ]},
//   {hostname: "localhost:4000", userId: [
//     "X3oicwXho45xzmyc6",
//     "iZY4CdELFN9eQv5sa"
//   ]}
// ];

var connect = function (hostname, userId) {
  console.log("connect:", hostname, userId);
  Connections[hostname] = DDP.connect(`https://${hostname}`);
  Collections[hostname] = new Mongo.Collection('pieces', {connection: Connections[hostname]});
  if (userId.constructor === Array) {
    Subscriptions[hostname] = Connections[hostname].subscribe("pieceMultiUserPosts", userId);
  } else {
    Subscriptions[hostname] = Connections[hostname].subscribe("pieceSingleUserPosts", userId);
  }
};

var observe = function (handle, hostname) {
  Tracker.autorun(function () {
    if (handle.ready()) {
      console.log("subscription from", hostname, "is ready");
      let cursor = Collections[hostname].find();
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
    connect(list.hostname, list.userId);
  });

  console.log("observation begins");
  _.each(Subscriptions, function (handle, hostname) {
    observe(handle, hostname);
  });
});

Template.cards.onDestroyed(function () {
  reset();
  Pieces.remove({});
});

Template.demo.onDestroyed(function () {
  reset();
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
// var urlParse = function (url) {
//   let urlParseRE = /^(((([^:\/#\?]+:)?(?:(\/\/)((?:(([^:@\/#\?]+)(?:\:([^:@\/#\?]+))?)@)?(([^:\/#\?\]\[]+|\[[^\/\]@#?]+\])(?:\:([0-9]+))?))?)?)?((\/?(?:[^\/\?#]+\/+)*)([^\?#]*)))?(\?[^#]+)?)(#.*)?/;
//   let matches = urlParseRE.exec(url);
//   let hostname = matches[10];
//   if (hostname === undefined) {
//     throw new Meteor.Error("undefined", "Server name is undefined.");
//   } else {
//     return hostname;
//   }
// }

var hostnameParse = function (url) {
  const urlParser = document.createElement('a');
  urlParser.href = url;
  if (urlParser.hostname === undefined) {
    throw new Meteor.Error("undefined", "Hostname is undefined.");
  } else {
    return urlParser.hostname;
  }
}

var subscribeViaForm = function (hostname, userId) {
  if (! Connections[hostname]) {
    connect(hostname, userId);
    observe(Subscriptions[hostname], hostname);
  } else {
    Connections[hostname].subscribe("pieceSingleUserPosts", userId);
  }
}

Template.form.events({
  'submit form': function (event, template) {
    event.preventDefault();
    let url = template.find("[name='url']").value;
    let hostname = hostnameParse(url).toLowerCase();
    let userId = template.find("[name='userId']").value;

    subscribeViaForm(hostname, userId);

    if (Meteor.userId()) {
      Meteor.call('subInsert', hostname, userId);
      console.log("sub inserted:", hostname, userId);
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
    let hostname = "piece.meteor.com";
    let userId = "492WZqeqCxrDqfG5u";
    subscribeViaForm(hostname, userId);
    template.subscribed.set(true);
  }
});

Template.follow.onCreated(function () {
  let hostname = FlowRouter.getQueryParam("hostname");
  let userId = FlowRouter.getQueryParam("userId");
  subscribeViaForm(hostname, userId);
});

Template.follow.helpers({
  button() {
    if (Meteor.user()) {
      return "Follow";
    } else {
      return "Please sign in ↖";
    }
  },
  disabled() {
    if (! Meteor.user()) {
      return "disabled";
    }
  },
  URL() {
    return "https://" + FlowRouter.getQueryParam("hostname");
  },
  userId() {
    return FlowRouter.getQueryParam("userId");
  },
  lists() {
    return Pieces.find({}, {sort: {createdAt: -1}});
  }
});

Template.follow.events({
  'submit form': function (event, template) {
    event.preventDefault();
    let url = template.find("[name='url']").value;
    let hostname = hostnameParse(url).toLowerCase();
    let userId = template.find("[name='userId']").value;

    if (Meteor.userId()) {
      Meteor.call('subInsert', hostname, userId, function (error, result) {
        if (! error) {
          FlowRouter.go("/");
        }
      });
    }
  }
});
