Meteor.publish("pieceCurrentUserSubs", function () {
  Meteor._sleepForMs(1000);
  return Subs.find({ownerId: this.userId});
});

Meteor.publish("pieceCurrentUserClones", function () {
  Meteor._sleepForMs(1000);
  return Clones.find({ownerId: this.userId}, {sort: {createdAt: 1}});
});

Meteor.publish("pieceCurrentCloneSubs", function (cloneId) {
  Meteor._sleepForMs(1000);
  check(cloneId, String);
  if (this.userId) {
    const userId = this.userId;
    const ownerId = Clones.findOne(cloneId).ownerId;
    if (userId === ownerId) {
      return Subs.find({ownerId: cloneId});
    } else {
      return this.ready();
    }
  } else {
    return this.ready();
  }
});
