Accounts.ui.config({
  passwordSignupFields: "USERNAME_ONLY"
});

Pieces = new Mongo.Collection(null); // Local collection

var reset = function () {
  Connections = Object.create(null);
  Collections = Object.create(null);
  Subscriptions = Object.create(null);
};

reset();

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
  Tracker.autorun(function (c) {
    if (handle.ready()) {
      console.log("subscription from", hostname, "is ready");
      if (Collections[hostname]) {
        let cursor = Collections[hostname].find();
        let cursorHandle = cursor.observeChanges({
          added: function (id, piece) {
            if (Pieces.findOne(id)) {
              console.log("found existed piece");
              return;
            } else {
              console.log("added:", id);
              piece._id = id;
              Pieces.insert(piece);
            }
          },
          removed: function (id) {
            console.log("removed:", id);
            Pieces.remove(id);
          }
        });
      } else {
        c.stop();
      }
    }
  })
}

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

Template.readerForm.onRendered(function () {
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
Template.readerForm.events({
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

Template.readerSubsWrapper.onCreated(function () {
  this.subscribe('pieceCurrentUserSubs');
  console.log('subscribed pieceCurrentUserSubs publication');
})
Template.readerSubsWrapper.helpers({
  hasSub() {
    return Subs.findOne();
  }
})

Template.readerPiecesWrapper.onCreated(function () {
  reset();
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
})
Template.readerPiecesWrapper.helpers({
  hasPiece() {
    return Pieces.findOne();
  },
  pieces() {
    return Pieces.find({}, {sort: {createdAt: -1}});
  }
})

Template.readerDemo.onCreated(function () {
  this.subscribed = new ReactiveVar(false);
})
Template.readerDemo.helpers({
  subscribed() {
    return Template.instance().subscribed.get();
  },
  pieces() {
    return Pieces.find({}, {sort: {createdAt: -1}});
  }
})
Template.readerDemo.events({
  'click [data-action=subscribe]': function (event, template) {
    event.preventDefault();
    let hostname = "piece.meteor.com";
    let userId = "492WZqeqCxrDqfG5u";
    subscribeViaForm(hostname, userId);
    template.subscribed.set(true);
  }
});

Template.followingSubsWrapper.helpers({
  subs() {
    return Subs.find({}, {sort: {hostname: 1}});
  }
})

Template.followPiecesWrapper.onCreated(function () {
  let hostname = FlowRouter.getQueryParam("hostname");
  let userId = FlowRouter.getQueryParam("userId");
  subscribeViaForm(hostname, userId);
})
Template.followPiecesWrapper.helpers({
  hasPiece() {
    return Pieces.findOne();
  },
  pieces() {
    let userId = FlowRouter.getQueryParam("userId");
    return Pieces.find({ownerId: userId}, {sort: {createdAt: -1}});
  }
})

Template.followForm.helpers({
  URL() {
    return "https://" + FlowRouter.getQueryParam("hostname");
  },
  userId() {
    return FlowRouter.getQueryParam("userId");
  }
})

Template.followButtonWrapper.onCreated(function () {
  this.subscribe('pieceCurrentUserSubs');
})

Template.followButton.onCreated(function () {
  this.unfollow = new ReactiveVar(false);
})
Template.followButton.helpers({
  following() {
    let hostname = FlowRouter.getQueryParam("hostname");
    let userId = FlowRouter.getQueryParam("userId");
    return followed = Subs.findOne({hostname: hostname, userId: {$in: [userId]}});
  },
  unfollow() {
    return Template.instance().unfollow.get();
  }
})
Template.followButton.events({
  'click [data-action=follow]': function (event, template) {
    event.preventDefault();
    let hostname = FlowRouter.getQueryParam("hostname");
    let userId = FlowRouter.getQueryParam("userId");
    console.log("follow:", hostname, userId);

    if (Meteor.userId()) {
      Meteor.call('subInsert', hostname, userId);
    }
  },
  'click [data-action=unfollow]': function (event, template) {
    event.preventDefault();
    let hostname = FlowRouter.getQueryParam("hostname");
    let userId = FlowRouter.getQueryParam("userId");
    console.log("unfollow:", hostname, userId);

    if (Meteor.userId()) {
      Meteor.call('subRemove', hostname, userId);
    }
  },
  'mouseenter [data-action=following]': function (event, template) {
    Template.instance().unfollow.set(true);
  },
  'mouseleave [data-action=unfollow]': function (event, template) {
    Template.instance().unfollow.set(false);
  }
})
