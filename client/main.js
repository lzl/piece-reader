Template.registerHelper('createdFromNow', (timestamp) => {
  if (timestamp === undefined) {
    return 'unknown';
  }
  const time = timestamp.getTime();
  const between = (TimeSync.serverTime() - time) / 1000;
  if (between < 60) {
    return ~~(between) + 's';
  } else if (between < 3600) {
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
  const between = (TimeSync.serverTime(null, 60 * 60 * 1000) - time) / 1000;
  if (between < 3600) {
    return 'just updated';
  } else if (between < 86400) {
    return 'updated today';
  } else {
    return ~~(between / 86400) + 'd';
  }
});
Template.registerHelper('publishedAt', (timestamp) => {
  return moment(timestamp).format('LLL');
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
  const protocol = Meteor.settings.public.protocol;
  Connections[hostname] = DDP.connect(`${protocol}://${hostname}`);
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
  const protocol = Meteor.settings.public.protocol;
  instance.connection = DDP.connect(`${protocol}://${hostname}`);
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

// Template.previewForm.onRendered(function () {
//   $("#subscribe").validate({
//     rules: {
//       url: {
//         required: true,
//         url: true
//       },
//       userId: {
//         required: true,
//         rangelength: [17, 17]
//       }
//     },
//     messages: {
//       userId: {
//         rangelength: "Please enter a valid user ID."
//       }
//     }
//   });
// });
// Template.previewForm.events({
//   'submit form': function (event, instance) {
//     event.preventDefault();
//     const url = instance.find("[name='url']").value;
//     const hostname = hostnameParse(url).toLowerCase();
//     const userId = instance.find("[name='userId']").value;
//     FlowRouter.go(`/follow?hostname=${hostname}&userId=${userId}`);
//   }
// });
Template.previewForm.onRendered(function () {
  $("#subscribe").validate({
    rules: {
      url: {
        required: true,
        url: true
      }
    }
  });
});
Template.previewForm.onCreated(function () {
  const instance = this;
  instance.state = new ReactiveDict();
  instance.state.setDefault('inputLength', 30);
});
Template.previewForm.helpers({
  length() {
    const instance = Template.instance();
    return instance.state.get('inputLength');
  }
});
Template.previewForm.events({
  'submit form': (event, instance) => {
    event.preventDefault();
    let hostname = instance.find("[name='url']").value;
    const parser = document.createElement('a');
    parser.href = hostname;
    hostname = parser.host;
    const pathname = parser.pathname;
    const type = pathname.substr(1, 1);
    const userId = pathname.substr(3, 17);
    if (type === "c" && userId.length === 17) {
      FlowRouter.go(`/follow?hostname=${hostname}&userId=${userId}`);
    } else {
      alert("Please enter a valid user ID.");
    }
  },
  'keyup [name=url]': (event, instance) => {
    event.preventDefault();
    const length = instance.find("[name='url']").value.length;
    if (length > 30) {
      instance.state.set('inputLength', length);
    } else {
      instance.state.set('inputLength', 30);
    }
  }
});

Template.demoPieces.onCreated(function () {
  const instance = this;
  const hostname = Meteor.settings.public.demo.hostname;
  const userId = Meteor.settings.public.demo.userId;
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
  const protocol = Meteor.settings.public.protocol;
  instance.connection = DDP.connect(`${protocol}://${hostname}`);
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
    return instance.state.get('username') || '...';
  },
  updatedAt() {
    const instance = Template.instance();
    return instance.state.get('updatedAt');
  }
})

Template.previewPieces.onCreated(function () {
  const instance = this;
  instance.state = new ReactiveDict();
  instance.state.setDefault({
    wantPiecesCount: 20
  });

  const hostname = FlowRouter.getQueryParam("hostname");
  const userId = FlowRouter.getQueryParam("userId");
  // previewViaForm(instance, hostname, userId, instance.state.get('wantPiecesCount'));
  const protocol = Meteor.settings.public.protocol;
  instance.connection = DDP.connect(`${protocol}://${hostname}`);
  instance['collection.pieces'] = new Mongo.Collection('pieces', {connection: instance.connection});
  instance.autorun(() => {
    const limit = instance.state.get('wantPiecesCount');
    instance['subscription.posts'] = instance.connection.subscribe("pieceSingleClonePosts", userId, limit);
  });
  instance['collection.clones'] = new Mongo.Collection('clones', {connection: instance.connection});
  instance.autorun(() => {
    instance['subscription.profile'] = instance.connection.subscribe("pieceSingleCloneProfile", userId);
  });
})
Template.previewPieces.helpers({
  hasPiece() {
    const instance = Template.instance();
    return instance['collection.pieces'].findOne();
  },
  pieces() {
    const instance = Template.instance();
    const userId = FlowRouter.getQueryParam("userId");
    return instance['collection.pieces'].find({ownerId: userId}, {sort: {createdAt: -1}});
  },
  showButton() {
    const instance = Template.instance();
    const userId = FlowRouter.getQueryParam("userId");
    const hasPiecesCount = instance['collection.pieces'].find({ownerId: userId}).count();
    return hasPiecesCount >= 20;
  },
  disabled() {
    const instance = Template.instance();
    const userId = FlowRouter.getQueryParam("userId");
    const hasPiecesCount = instance['collection.pieces'].find({ownerId: userId}).count();
    const wantPiecesCount = instance.state.get('wantPiecesCount');
    if (hasPiecesCount < wantPiecesCount) {
      return 'disabled';
    } else {
      return '';
    }
  },
  profile() {
    const instance = Template.instance();
    return instance['collection.clones'].findOne();
  }
})
Template.previewPieces.events({
  'click [data-action=more]': (event, instance) => {
    event.preventDefault();
    instance.state.set('wantPiecesCount', instance.state.get('wantPiecesCount') + 20);
  }
})

Template.previewPieceContent.helpers({
  typeIsPlaintext() {
    const piece = Template.instance().data.piece;
    return piece.type === 'plaintext';
  },
  typeIsHyperlink() {
    const piece = Template.instance().data.piece;
    return piece.type === 'hyperlink';
  },
  typeIsSharismPiece() {
    const piece = Template.instance().data.piece;
    return piece.type === 'sharism-piece';
  }
})

Template.followForm.onCreated(function () {
  const instance = this;
  instance.state = new ReactiveDict;
  instance.state.setDefault('addressLength', 30);
})
Template.followForm.helpers({
  address() {
    const protocol = Meteor.settings.public.protocol;
    const hostname = FlowRouter.getQueryParam("hostname");
    const userId = FlowRouter.getQueryParam("userId");
    const address = `${protocol}://${hostname}/c/${userId}`;
    const instance = Template.instance();
    instance.state.set('addressLength', address.length);
    return address;
  },
  length() {
    const instance = Template.instance();
    return instance.state.get('addressLength');
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
  'click [data-action=follow]': function (event, instance) {
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
  'click [data-action=unfollow]': function (event, instance) {
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
  'mouseenter [data-action=following]': function (event, instance) {
    event.preventDefault();
    return instance.unfollow.set(true);
  },
  'mouseleave [data-action=unfollow]': function (event, instance) {
    event.preventDefault();
    return instance.unfollow.set(false);
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
    // always return true when at 'follow' router
    return Subs.findOne() || FlowRouter.getRouteName() === 'follow';
  }
})

Template.piecesWrapper.onCreated(function () {
  // set piecesLimitByDate to yesterday
  Session.setDefault("piecesLimitBy", "date");
  Session.setDefault("piecesLimitByDate", (function(d){d.setDate(d.getDate()-1); return d;})(new Date));
  Session.setDefault("piecesLimitByNumber", 20);
  Session.setDefault('lastestRefreshTimestamp', new Date());
  const instance = this;
  instance.state = new ReactiveDict();
  instance.connections = Object.create(null);
  instance.collections = Object.create(null);
  instance.subscriptions = Object.create(null);
  // console.log(instance);

  const protocol = Meteor.settings.public.protocol;
  const subsCursor = Subs.find();
  const subsCursorHandle = subsCursor.observeChanges({
    added(id, sub) {
      const hostname = sub.hostname;
      const userId = sub.userId;
      instance.connections[hostname] = DDP.connect(`${protocol}://${hostname}`);
      instance.collections[hostname] = new Mongo.Collection('pieces', {connection: instance.connections[hostname]});
    }
  })

  instance.autorun(() => {
    // instance.connections = Object.create(null);
    // instance.collections = Object.create(null);
    // instance.subscriptions = Object.create(null);

    const subsCursor = Subs.find();
    const subs = subsCursor.fetch();
    instance.state.set('observedHostNum', 0);
    instance.state.set('totalHostNum', subsCursor.count());

    // console.log("subs:", subs);
    // _.each(subs, (sub) => {
    //   const hostname = sub.hostname;
    //   const userId = sub.userId;
    //   const protocol = Meteor.settings.public.protocol;
    //   instance.connections[hostname] = DDP.connect(`${protocol}://${hostname}`);
    //   instance.collections[hostname] = new Mongo.Collection('pieces', {connection: instance.connections[hostname]});
    //   if (userId.constructor === Array) {
    //     if (Session.get("piecesLimitBy") === "date") {
    //       instance.subscriptions[hostname] = instance.connections[hostname].subscribe("pieceMultiUserPostsByDate", userId, Session.get("piecesLimitByDate"));
    //     } else {
    //       instance.subscriptions[hostname] = instance.connections[hostname].subscribe("pieceMultiUserPosts", userId, Session.get("piecesLimitByNumber"));
    //     }
    //   } else {
    //     instance.subscriptions[hostname] = instance.connections[hostname].subscribe("pieceSingleClonePosts", userId);
    //   }
    // })

    console.log("subs:", subs);
    _.each(subs, (sub) => {
      const hostname = sub.hostname;
      const userId = sub.userId;
      // const protocol = Meteor.settings.public.protocol;
      // instance.connections[hostname] = DDP.connect(`${protocol}://${hostname}`);
      // instance.collections[hostname] = new Mongo.Collection('pieces', {connection: instance.connections[hostname]});
      if (userId.constructor === Array) {
        if (Session.get("piecesLimitBy") === "date") {
          instance.subscriptions[hostname] = instance.connections[hostname].subscribe("pieceMultiUserPostsByDate", userId, Session.get("piecesLimitByDate"));
        } else {
          instance.subscriptions[hostname] = instance.connections[hostname].subscribe("pieceMultiUserPosts", userId, Session.get("piecesLimitByNumber"));
        }
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
  instance.oldPieces = () => {
    const lastestRefreshTimestamp = Session.get('lastestRefreshTimestamp');
    return LocalPieces.find({createdAt: {$lte: lastestRefreshTimestamp}}, {sort: {createdAt: -1}});
  }
  instance.percentage = () => {
    return instance.state.get('observedHostNum') / instance.state.get('totalHostNum') * 100;
  }
  instance.observationIsDone = () => {
    return instance.state.get('observedHostNum') === instance.state.get('totalHostNum');
  }

  instance.autorun(() => {
    if (instance.state.get('observedHostNum') === instance.state.get('totalHostNum')) {
      if (! LocalPieces.findOne()) {
        console.info("there is no piece today, changed to limit by number");
        Session.set('piecesLimitBy', 'number');
      }
    }
  })
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
      oldPieces: instance.oldPieces,
      percentage: instance.percentage,
      observationIsDone: instance.observationIsDone
    }
  }
})

Template.readerPieceContent.helpers({
  typeIsPlaintext() {
    const piece = Template.instance().data.piece;
    return piece.type === 'plaintext';
  },
  typeIsHyperlink() {
    const piece = Template.instance().data.piece;
    return piece.type === 'hyperlink';
  },
  typeIsSharismPiece() {
    const piece = Template.instance().data.piece;
    return piece.type === 'sharism-piece';
  }
})


Template.readerPieceButton.helpers({
  typeIsSharism() {
    const piece = Template.instance().data.piece;
    return piece.type.indexOf('sharism') > -1;
  },
  shareDisabled() {
    return Meteor.settings.public.feature.share ? '' : 'disabled';
  }
})

Template.readerPieceButton.events({
  'click [data-action=detail]': (event, instance) => {
    event.preventDefault();
    const modalId = instance.data.piece._id;
    instance.$(`#detail-${modalId}`).modal('show');
  },
  'click [data-action=share]': (event, instance) => {
    event.preventDefault();
    let modalId = undefined;
    if (instance.data.piece.origin) {
      modalId = instance.data.piece.origin._id;
    } else {
      modalId = instance.data.piece._id;
    }
    instance.$(`#share-${modalId}`).modal('show');
    instance.$(`#share-${modalId}`).on('shown.bs.modal', () => {
      instance.find('[autofocus]').focus();
    });
  }
})

Template.readerPieceShare.onCreated(function () {
  const instance = this;
  instance.state = new ReactiveDict();
  instance.state.setDefault({
    'commentContent': '',
    'selectCloneId': Session.get('currentCloneId')
  })
})
Template.readerPieceShare.helpers({
  modalId() {
    const instance = Template.instance();
    const modalId = instance.data.piece._id;
    return `share-${modalId}`;
  },
  commentContent() {
    const instance = Template.instance();
    return instance.state.get('commentContent');
  },
  hasMoreThanOneClone() {
    return Clones.find().count() > 1;
  },
  currentClone() {
    const currentCloneId = Session.get('currentCloneId');
    return Clones.findOne({_id: currentCloneId});
  },
  otherClones() {
    const currentCloneId = Session.get('currentCloneId');
    return Clones.find({_id: {$ne: currentCloneId}}).fetch();
  },
  selectClone() {
    const instance = Template.instance();
    const selectCloneId = instance.state.get('selectCloneId');
    return Clones.findOne({_id: selectCloneId});
  }
})
Template.readerPieceShare.events({
  'keyup [name=comment]': (event, instance) => {
    event.preventDefault();
    const comment = instance.find("[name='comment']").value;
    instance.state.set('commentContent', comment);
  },
  'change [name=selectClone]': (event, instance) => {
    event.preventDefault();
    const selectCloneId = instance.find("[name='selectClone']").value;
    instance.state.set('selectCloneId', selectCloneId);
  },
  'click [data-action=submit]': (event, instance) => {
    event.preventDefault();
    const comment = instance.find("[name='comment']").value;
    const piece = instance.data.piece;
    const cloneId = instance.state.get('selectCloneId');
    const modalId = instance.data.piece._id;
    if (Meteor.userId()) {
      Meteor.call('pieceShareByClone', piece, comment, cloneId, () => {
        instance.$(`#share-${modalId}`).modal('hide');
      });
    }
  }
})

Template.readerPieceDetail.onRendered(function () {
  const instance = this;
  const button = '.address-' + instance.data.piece.ownerId;
  $(button).tooltip();
  const clipboard = new Clipboard(button);
  clipboard.on('success', function(e) {
    $(e.trigger).attr("title", "Copied!").tooltip("_fixTitle").tooltip("show").attr("title", "Copy to clipboard").tooltip("_fixTitle"), e.clearSelection();
  });

  clipboard.on('error', function(e) {
    const title = /Mac/i.test(navigator.userAgent) ? "Press ⌘-C to copy" : "Press Ctrl-C to copy";
    $(e.trigger).attr("title", title).tooltip("_fixTitle").tooltip("show").attr("title", "Copy to clipboard").tooltip("_fixTitle");
  });
})
Template.readerPieceDetail.helpers({
  modalId() {
    const instance = Template.instance();
    const modalId = instance.data.piece._id;
    return `detail-${modalId}`;
  },
  address() {
    const instance = Template.instance();
    const piece = instance.data.piece;
    const protocol = Meteor.settings.public.protocol;
    return `${protocol}://${piece.hostname}/c/${piece.ownerId}`;
  },
  originAddress() {
    const instance = Template.instance();
    const piece = instance.data.piece;
    const protocol = Meteor.settings.public.protocol;
    return `${protocol}://${piece.origin.hostname}/c/${piece.origin.ownerId}`;
  }
})
Template.readerPieceDetail.events({
  'click [data-action=preview]': (event, instance) => {
    event.preventDefault();
    const hostname = instance.data.piece.hostname;
    const userId = instance.data.piece.ownerId;
    const modalId = instance.data.piece._id;
    $(`#detail-${modalId}`).modal('hide');
    $(`#detail-${modalId}`).on('hidden.bs.modal', () => {
      FlowRouter.go(`/follow?hostname=${hostname}&userId=${userId}`);
    });
  },
  'click [data-action=previewOrigin]': (event, instance) => {
    event.preventDefault();
    const hostname = instance.data.piece.origin.hostname;
    const userId = instance.data.piece.origin.ownerId;
    const modalId = instance.data.piece._id;
    $(`#detail-${modalId}`).modal('hide');
    $(`#detail-${modalId}`).on('hidden.bs.modal', () => {
      FlowRouter.go(`/follow?hostname=${hostname}&userId=${userId}`);
    });
  },
})

Template.readerPieceDetailFollowButton.onCreated(function () {
  this.unfollow = new ReactiveVar(false);
})
Template.readerPieceDetailFollowButton.helpers({
  following() {
    const instance = Template.instance();
    const hostname = instance.data.piece.hostname;
    const userId = instance.data.piece.ownerId;
    return followed = Subs.findOne({hostname: hostname, userId: {$in: [userId]}});
  },
  unfollow() {
    return Template.instance().unfollow.get();
  }
})
Template.readerPieceDetailFollowButton.events({
  'click [data-action=follow]': function (event, instance) {
    event.preventDefault();
    const hostname = instance.data.piece.hostname;
    const userId = instance.data.piece.ownerId;

    if (Meteor.userId()) {
      const cloneId = Session.get("currentCloneId");
      Meteor.call('subInsertByClone', cloneId, hostname, userId, function (err, result) {
        if (!err) {
          console.log("follow:", hostname, userId, "by", cloneId);
        }
      });
    }
  },
  'click [data-action=unfollow]': function (event, instance) {
    event.preventDefault();
    let hostname = instance.data.piece.hostname;
    let userId = instance.data.piece.ownerId;

    if (Meteor.userId()) {
      const cloneId = Session.get("currentCloneId");
      Meteor.call('subRemoveByClone', cloneId, hostname, userId, function (err, result) {
        if (!err) {
          console.log("unfollow:", hostname, userId, "by", cloneId);
        }
      });
    }
  },
  'mouseenter [data-action=following]': function (event, instance) {
    event.preventDefault();
    return instance.unfollow.set(true);
  },
  'mouseleave [data-action=unfollow]': function (event, instance) {
    event.preventDefault();
    return instance.unfollow.set(false);
  }
})

Template.readerPiecesReadMoreButton.helpers({
  disabled() {
    if (Session.get("piecesLimitBy") === "date") {
      const MIN_DATE = (function(d){d.setDate(d.getDate()-7); return d;})(new Date);
      return Session.get("piecesLimitByDate") <= MIN_DATE ? "disabled" : '';
    } else {
      return Session.get("piecesLocalCount") === LocalPieces.find().count() ? "disabled": '';
    }
  }
})
Template.readerPiecesReadMoreButton.events({
  'click [data-action=more]': (event, instance) => {
    Session.set("piecesLocalCount", LocalPieces.find().count());
    if (Session.get("piecesLocalCount") < 20) {
      console.info("there are less than 20 pieces today, changed to limit by number");
      Session.set("piecesLimitBy", "number");
    } else if (Session.get("piecesLimitBy") === "date") {
      console.info("load more: 1 day");
      Session.set("piecesLimitByDate", (function(d){d.setDate(d.getDate()-1); return d;})(Session.get("piecesLimitByDate")));
    } else {
      console.info("load more: 20 pieces");
      Session.set("piecesLimitByNumber", Session.get("piecesLimitByNumber") + 20);
    }
  }
})
