Template.registerHelper('fromNow', (timestamp) => {
  const time = timestamp.getTime();
  const between = (Date.now() - time) / 1000;
  if (between < 3600) {
    return ~~(between / 60) + 'm';
  } else if (between < 86400) {
    return ~~(between / 3600) + 'h';
  } else {
    return ~~(between / 86400) + 'd'
  }
});

Tracker.autorun(function () {
  console.log("server connection status:", Meteor.status().status, new Date());
});

Accounts.ui.config({
  passwordSignupFields: "USERNAME_ONLY"
});

Pieces = new Mongo.Collection(null); // Local collection

const reset = function () {
  console.log("reset: local connections, collections and subscriptions")
  Connections = Object.create(null);
  Collections = Object.create(null);
  Subscriptions = Object.create(null);
};

reset();

const connect = function (hostname, userId) {
  console.log("connect:", hostname, userId);
  Connections[hostname] = DDP.connect(`https://${hostname}`);
  Collections[hostname] = new Mongo.Collection('pieces', {connection: Connections[hostname]});
  if (userId.constructor === Array) {
    Subscriptions[hostname] = Connections[hostname].subscribe("pieceMultiUserPosts", userId);
  } else {
    Subscriptions[hostname] = Connections[hostname].subscribe("pieceSingleClonePosts", userId);
  }
};

const observe = function (handle, hostname, subscriptionIsReady) {
  Tracker.autorun(function (c) {
    if (handle.ready()) {
      console.log("subscription from", hostname, "is ready");
      Tracker.nonreactive(function () {
        subscriptionIsReady();
      })
      if (Collections[hostname]) {
        let cursor = Collections[hostname].find();
        let cursorHandle = cursor.observeChanges({
          added: function (id, piece) {
            let existed = undefined;
            Tracker.nonreactive(function () {
              existed = Pieces.findOne(id);
            })
            if (existed) {
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

const hostnameParse = function (url) {
  const urlParser = document.createElement('a');
  urlParser.href = url;
  if (urlParser.hostname === undefined) {
    throw new Meteor.Error("undefined", "Hostname is undefined.");
  } else {
    return urlParser.hostname;
  }
}

const subscribeViaForm = function (hostname, userId) {
  if (! Connections[hostname]) {
    connect(hostname, userId);
    observe(Subscriptions[hostname], hostname);
  } else {
    Connections[hostname].subscribe("pieceSingleUserPosts", userId);
  }
}

const previewViaForm = function (hostname, userId) {
  console.log("previewViaForm:", hostname, userId);
  const connection = DDP.connect(`https://${hostname}`);
  PiecesPreview = new Mongo.Collection('pieces', {connection: connection});
  const subscription = connection.subscribe("pieceSingleClonePosts", userId);
}

Template.status.helpers({
  connecting() {
    return Meteor.status().status === 'connecting';
  },
  connected() {
    return Meteor.status().status === 'connected';
  },
  failed() {
    return Meteor.status().status === 'failed';
  },
  waiting() {
    return Meteor.status().status === 'waiting';
  },
  offline() {
    return Meteor.status().status === 'offline';
  }
})

Template.previewForm.onRendered(function () {
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
Template.previewForm.events({
  'submit form': function (event, template) {
    event.preventDefault();
    const url = template.find("[name='url']").value;
    const hostname = hostnameParse(url).toLowerCase();
    const userId = template.find("[name='userId']").value;
    FlowRouter.go(`/follow?hostname=${hostname}&userId=${userId}`)
  }
});

Template.hasSubOrNot.helpers({
  hasSub() {
    return Subs.findOne();
  }
})

Template.readerPieces.onCreated(function () {
  const instance = Template.instance();
  this.data.observedHostNum = new ReactiveVar(0);
  this.data.totalHostNum = new ReactiveVar(0);

  this.autorun(function () {
    reset();

    let listsCursor = Subs.find();
    let lists = listsCursor.fetch();
    instance.data.totalHostNum.set(listsCursor.count());

    console.log("subs:", lists);
    _.each(lists, function (list) {
      connect(list.hostname, list.userId);
    });

    console.log("observation begins");
    _.each(Subscriptions, function (handle, hostname) {
      observe(handle, hostname, () => {
        instance.data.observedHostNum.set(instance.data.observedHostNum.get() + 1);
      });
    });
  });
})
Template.readerPieces.helpers({
  hasPiece() {
    return Pieces.findOne();
  },
  pieces() {
    return Pieces.find({}, {sort: {createdAt: -1}});
  },
  percentage() {
    const instance = Template.instance();
    return instance.data.observedHostNum.get() / instance.data.totalHostNum.get() * 100;
  },
  observationIsDone() {
    const instance = Template.instance();
    return instance.data.observedHostNum.get() === instance.data.totalHostNum.get();
  }
})

Template.demoPieces.onCreated(function () {
  const hostname = "piece.meteor.com";
  const userId = "Eqrz7jo3YcMeabNdg";
  previewViaForm(hostname, userId);
})
Template.demoPieces.helpers({
  hasPiece() {
    return PiecesPreview.findOne();
  },
  pieces() {
    return PiecesPreview.find({}, {sort: {createdAt: -1}});
  }
})

Template.followingSubs.helpers({
  subs() {
    return Subs.find({}, {sort: {hostname: 1}});
  }
})

Template.followingSub.onCreated(function () {
  const hostname = this.data.hostname;
  const userIds = this.data.userId;
  const connection = DDP.connect(`https://${hostname}`);
  this.data.clones = new Mongo.Collection('clones', {connection: connection});
  const subscription = connection.subscribe("pieceMultiCloneProfiles", userIds);
  this.data.ready = new ReactiveVar(false);
  this.autorun(() => {
    this.data.ready.set(subscription.ready());
  })
})

Template.followingSubDetail.onCreated(function () {
  this.username = new ReactiveVar("loading");
  const userId = this.data.userId;
  this.autorun(() => {
    if (this.data.ready.get()) {
      const username = this.data.clones.findOne({_id: userId}).name;
      this.username.set(username);
    }
  })
})
Template.followingSubDetail.helpers({
  username() {
    const instance = Template.instance();
    return instance.username.get();
  }
})

Template.previewPieces.onCreated(function () {
  const hostname = FlowRouter.getQueryParam("hostname");
  const userId = FlowRouter.getQueryParam("userId");
  previewViaForm(hostname, userId);
})
Template.previewPieces.helpers({
  hasPiece() {
    return PiecesPreview.findOne();
  },
  pieces() {
    const userId = FlowRouter.getQueryParam("userId");
    return PiecesPreview.find({ownerId: userId}, {sort: {createdAt: -1}});
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

Template.followButton.onCreated(function () {
  this.unfollow = new ReactiveVar(false);
})
Template.followButton.helpers({
  following() {
    const hostname = FlowRouter.getQueryParam("hostname");
    const userId = FlowRouter.getQueryParam("userId");
    return followed = Subs.findOne({hostname: hostname, userId: {$in: [userId]}});
  },
  unfollow() {
    return Template.instance().unfollow.get();
  }
})
Template.followButton.events({
  'click [data-action=follow]': function (event, template) {
    event.preventDefault();
    const hostname = FlowRouter.getQueryParam("hostname");
    const userId = FlowRouter.getQueryParam("userId");

    if (Meteor.userId()) {
      const cloneId = Session.get("currentCloneId");
      Meteor.call('subInsertByClone', cloneId, hostname, userId, function (err, result) {
        if (!err) {
          console.log("follow:", hostname, userId, "by", cloneId);
        }
      });
    }
  },
  'click [data-action=unfollow]': function (event, template) {
    event.preventDefault();
    let hostname = FlowRouter.getQueryParam("hostname");
    let userId = FlowRouter.getQueryParam("userId");

    if (Meteor.userId()) {
      const cloneId = Session.get("currentCloneId");
      Meteor.call('subRemoveByClone', cloneId, hostname, userId, function (err, result) {
        if (err) {
          return;
        }
        if (Pieces.findOne({ownerId: userId})) {
          Pieces.remove({ownerId: userId});
        }
        console.log("unfollow:", hostname, userId, "by", cloneId);
      });
    }
  },
  'mouseenter [data-action=following]': function (event, template) {
    Template.instance().unfollow.set(true);
  },
  'mouseleave [data-action=unfollow]': function (event, template) {
    Template.instance().unfollow.set(false);
  }
})

Template.clonesWrapper.onCreated(function () {
  // set currentCloneId with current user's id if it wasn't set before
  Session.setDefault("currentCloneId", Meteor.userId());
  this.subscribe('pieceCurrentUserClones');
  console.log('subscribe: pieceCurrentUserClones');
})

Template.subsWrapper.onCreated(function () {
  this.autorun(() => {
    // if currentCloneId was set, then check if it belongs to current user
    if (! Clones.findOne(Session.get("currentCloneId"))) {
      // if not, then set again
      Session.set("currentCloneId", Clones.findOne()._id);
    }
    this.subscribe('pieceCurrentCloneSubs', Session.get("currentCloneId"));
    console.log('subscribe: pieceCurrentCloneSubs by', Session.get("currentCloneId"));
  });
})
