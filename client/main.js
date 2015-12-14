Template.registerHelper('createdFromNow', (timestamp) => {
  if (timestamp === undefined) {
    return 'unknown';
  }
  const time = timestamp.getTime();
  const between = (Date.now() - time) / 1000;
  if (between < 3600) {
    return ~~(between / 60) + 'm';
  } else if (between < 86400) {
    return ~~(between / 3600) + 'h';
  } else {
    return ~~(between / 86400) + 'd';
  }
});
Template.registerHelper('updatedFromNow', (timestamp) => {
  if (timestamp === undefined) {
    return 'unknown';
  }
  const time = timestamp.getTime();
  const between = (Date.now() - time) / 1000;
  if (between < 3600) {
    return 'just updated';
  } else if (between < 86400) {
    return 'updated today';
  } else {
    return ~~(between / 86400) + 'd';
  }
});

Tracker.autorun(function () {
  console.log("server connection status:", Meteor.status().status, new Date());
});

Accounts.ui.config({
  passwordSignupFields: "USERNAME_ONLY"
});

LocalPieces = new Mongo.Collection(null); // Local collection
LocalClones = new Mongo.Collection(null); // Local collection

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

const previewViaForm = function (instance, hostname, userId) {
  console.log("previewViaForm:", hostname, userId);
  instance.connection = DDP.connect(`https://${hostname}`);
  instance.collection = new Mongo.Collection('pieces', {connection: instance.connection});
  instance.subscription = instance.connection.subscribe("pieceSingleClonePosts", userId);
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

Template.demoPieces.onCreated(function () {
  const instance = this;
  const hostname = "piece.meteor.com";
  const userId = "Eqrz7jo3YcMeabNdg";
  previewViaForm(instance, hostname, userId);
})
Template.demoPieces.helpers({
  hasPiece() {
    const instance = Template.instance();
    return instance.collection.findOne();
  },
  pieces() {
    const instance = Template.instance();
    return instance.collection.find({}, {sort: {createdAt: -1}});
  }
})

Template.followingSubs.helpers({
  subs() {
    return Subs.find({}, {sort: {hostname: 1}});
  }
})

Template.followingSub.onCreated(function () {
  const instance = this;
  const subsLength = _.chain(Subs.find().fetch()).pluck('userId').flatten().value().length;
  if (LocalClones.find().count() === subsLength) {
    console.log("found local clones")
    return;
  }
  const hostname = instance.data.sub.hostname;
  const userIds = instance.data.sub.userId;
  instance.connection = DDP.connect(`https://${hostname}`);
  instance.collection = new Mongo.Collection('clones', {connection: instance.connection});
  instance.subscription = instance.connection.subscribe("pieceMultiCloneProfiles", userIds);

  const cursor = instance.collection.find();
  const cursorHandle = cursor.observeChanges({
    added(id, clone) {
      let existed = undefined;
      Tracker.nonreactive(function () {
        existed = LocalClones.findOne(id);
      })
      if (existed) {
        console.log("found existed local clone");
        return;
      } else {
        console.log("local clone added:", id);
        clone._id = id;
        LocalClones.insert(clone);
      }
    },
    changed(id, fields) {
      console.log("local clone changed:", id, fields);
      LocalClones.update({_id: id}, {$set: fields});
    },
    removed(id) {
      console.log("local clone removed:", id);
      LocalClones.remove(id);
    }
  });
})

Template.followingSubDetail.onCreated(function () {
  const instance = this;
  instance.state = new ReactiveDict();
  this.autorun(() => {
    const userId = this.data.userId;
    if (LocalClones.find({_id: userId}).count()) {
      const clone = LocalClones.findOne({_id: userId});
      instance.state.set('username', clone.name);
      instance.state.set('updatedAt', clone.updatedAt);
    }
  })
})
Template.followingSubDetail.helpers({
  username() {
    const instance = Template.instance();
    return instance.state.get('username');
  },
  updatedAt() {
    const instance = Template.instance();
    return instance.state.get('updatedAt');
  }
})

Template.previewPieces.onCreated(function () {
  const instance = this;
  const hostname = FlowRouter.getQueryParam("hostname");
  const userId = FlowRouter.getQueryParam("userId");
  previewViaForm(instance, hostname, userId);
})
Template.previewPieces.helpers({
  hasPiece() {
    const instance = Template.instance();
    return instance.collection.findOne();
  },
  pieces() {
    const instance = Template.instance();
    const userId = FlowRouter.getQueryParam("userId");
    return instance.collection.find({ownerId: userId}, {sort: {createdAt: -1}});
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
        if (LocalPieces.findOne({ownerId: userId})) {
          LocalPieces.remove({ownerId: userId});
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
Template.subsWrapper.helpers({
  hasSub() {
    return Subs.findOne()
  }
})

Template.piecesWrapper.onCreated(function () {
  const instance = this;
  instance.state = new ReactiveDict();

  instance.autorun(() => {
    instance.connections = Object.create(null);
    instance.collections = Object.create(null);
    instance.subscriptions = Object.create(null);

    const subsCursor = Subs.find();
    const subs = subsCursor.fetch();
    instance.state.set('observedHostNum', 0);
    instance.state.set('totalHostNum', subsCursor.count());

    console.log("subs:", subs);
    _.each(subs, (sub) => {
      const hostname = sub.hostname;
      const userId = sub.userId;
      instance.connections[hostname] = DDP.connect(`https://${hostname}`);
      instance.collections[hostname] = new Mongo.Collection('pieces', {connection: instance.connections[hostname]});
      if (userId.constructor === Array) {
        instance.subscriptions[hostname] = instance.connections[hostname].subscribe("pieceMultiUserPosts", userId);
      } else {
        instance.subscriptions[hostname] = instance.connections[hostname].subscribe("pieceSingleClonePosts", userId);
      }
    })

    console.log("observation begins");
    _.each(instance.subscriptions, (handle, hostname) => {
      Tracker.autorun((c) => {
        if (handle.ready()) {
          console.log("subscription from", hostname, "is ready");
          Tracker.nonreactive(function () {
            instance.state.set('observedHostNum', instance.state.get('observedHostNum') + 1);
          })
          if (instance.collections[hostname]) {
            let cursor = instance.collections[hostname].find();
            let cursorHandle = cursor.observeChanges({
              added: function (id, piece) {
                let existed = undefined;
                Tracker.nonreactive(function () {
                  existed = LocalPieces.findOne(id);
                })
                if (existed) {
                  console.log("found existed piece");
                  return;
                } else {
                  console.log("added:", id);
                  piece._id = id;
                  LocalPieces.insert(piece);
                }
              },
              removed: function (id) {
                console.log("removed:", id);
                LocalPieces.remove(id);
              }
            });
          } else {
            c.stop();
          }
        }
      })
    })
  });

  // for debug
  instance.autorun(() => {
    console.log('observedHostNum', instance.state.get('observedHostNum'))
    console.log('totalHostNum', instance.state.get('totalHostNum'))
  })

  instance.hasPiece = () => {
    return LocalPieces.findOne();
  }
  instance.pieces = () => {
    return LocalPieces.find({}, {sort: {createdAt: -1}});
  }
  instance.percentage = () => {
    return instance.state.get('observedHostNum') / instance.state.get('totalHostNum') * 100;
  }
  instance.observationIsDone = () => {
    return instance.state.get('observedHostNum') === instance.state.get('totalHostNum');
  }
})
Template.piecesWrapper.onDestroyed(function () {
  return LocalPieces.remove({});
})
Template.piecesWrapper.helpers({
  data() {
    const instance = Template.instance();
    return {
      data: instance.data,
      hasPiece: instance.hasPiece,
      pieces: instance.pieces,
      percentage: instance.percentage,
      observationIsDone: instance.observationIsDone
    }
  }
})
