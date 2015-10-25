Meteor.publish("pieceCurrentUserSubs", function () {
  return Subs.find({ownerId: this.userId});
});
