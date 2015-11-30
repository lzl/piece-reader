Meteor.methods({
  subInsert: function (hostname, userId) {
    check(hostname, String);
    check(userId, String);

    if (! Meteor.userId()) {
      throw new Meteor.Error("not-authorized", "Log in before subscribe.");
    }

    const ownerId = Meteor.userId();
    const exitedHostname = !! Subs.findOne({ownerId: ownerId, hostname: hostname});
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
      throw new Meteor.Error("not-authorized", "Log in before unsubscribe.");
    }

    const ownerId = Meteor.userId();
    const exitedHostname = !! Subs.findOne({ownerId: ownerId, hostname: hostname});
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
  },
  subInsertByClone: function (cloneId, subHostname, subUserId) {
    check(cloneId, String);
    check(subHostname, String);
    check(subUserId, String);

    const userId = Meteor.userId();
    if (! userId) {
      throw new Meteor.Error("not-authorized", "Log in before subscribe.");
    }

    const ownedClone = Clones.findOne({_id: cloneId, ownerId: userId});
    if (ownedClone) {
      const exitedHostname = !! Subs.findOne({ownerId: cloneId, hostname: subHostname});
      if (exitedHostname) {
        return Subs.update({ownerId: cloneId, hostname: subHostname}, {
          $addToSet: {userId: subUserId}
        });
      } else {
        return Subs.insert({
          ownerId: cloneId,
          hostname: subHostname,
          userId: [subUserId]
        })
      }
    } else {
      throw new Meteor.Error("not-authorized", "You don't own that clone.");
    }
  },
  subRemoveByClone: function (cloneId, subHostname, subUserId) {
    check(cloneId, String);
    check(subHostname, String);
    check(subUserId, String);

    const userId = Meteor.userId();
    if (! userId) {
      throw new Meteor.Error("not-authorized", "Log in before subscribe.");
    }

    const ownedClone = Clones.findOne({_id: cloneId, ownerId: userId});
    if (ownedClone) {
      const exitedHostname = !! Subs.findOne({ownerId: cloneId, hostname: subHostname});
      if (exitedHostname) {
        let length = Subs.findOne({ownerId: cloneId, hostname: subHostname}).userId.length;
        if (length === 1) {
          return Subs.remove({ownerId: cloneId, hostname: subHostname});
        } else {
          return Subs.update({ownerId: cloneId, hostname: subHostname}, {
            $pull: {userId: subUserId}
          });
        }
      }
    } else {
      throw new Meteor.Error("not-authorized", "You don't own that clone.");
    }
  },
});
