Meteor.methods({
  subInsert: function (hostname, userId) {
    check(hostname, String);
    check(userId, String);
    let ownerId = Meteor.userId();

    if (! Meteor.userId()) {
      throw new Meteor.Error("not-authorized", "Log in before subscribe.");
    }

    var exitedHostname = !! Subs.findOne({ownerId: ownerId, hostname: hostname});
    if (exitedHostname) {
      return Subs.update({ownerId: ownerId, hostname: hostname}, {
        $addToSet: {userId: userId}
      });
    } else {
      return Subs.insert({
        ownerId: ownerId,
        hostname: hostname,
        userId: [userId]
      })
    }
  },
  subRemove: function (hostname, userId) {
    check(hostname, String);
    check(userId, String);

    if (! Meteor.userId()) {
      throw new Meteor.Error("not-authorized", "Log in before subscribe.");
    }

    let ownerId = Meteor.userId();
    var exitedHostname = !! Subs.findOne({ownerId: ownerId, hostname: hostname});
    if (exitedHostname) {
      let length = Subs.findOne({ownerId: ownerId, hostname: hostname}).userId.length;
      if (length === 1) {
        return Subs.remove({ownerId: ownerId, hostname: hostname});
      } else {
        return Subs.update({ownerId: ownerId, hostname: hostname}, {
          $pull: {userId: userId}
        });
      }
    }
  }
});
