Meteor.methods({
  subInsert: function (server, userId) {
    check(server, String);
    check(userId, String);
    let ownerId = Meteor.userId();

    if (! Meteor.userId()) {
      throw new Meteor.Error("not-authorized", "Log in before subscribe.");
    }

    var exitedServer = !! Subs.findOne({ownerId: ownerId, server: server});
    if (exitedServer) {
      return Subs.update({ownerId: ownerId, server: server}, {
        $addToSet: {userId: userId}
      });
    } else {
      return Subs.insert({
        ownerId: ownerId,
        server: server,
        userId: [userId]
      })
    }
  }
});
