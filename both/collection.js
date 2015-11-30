Subs = new Mongo.Collection('subs');
Subs.allow({
  insert() { return false; },
  update() { return false; },
  remove() { return false; }
});
Subs.deny({
  insert() { return true; },
  update() { return true; },
  remove() { return true; }
});

Clones = new Mongo.Collection('clones');
Clones.allow({
  insert() { return false; },
  update() { return false; },
  remove() { return false; }
});
Clones.deny({
  insert() { return true; },
  update() { return true; },
  remove() { return true; }
});

Meteor.users.allow({
  insert() { return false; },
  update() { return false; },
  remove() { return false; }
});
Meteor.users.deny({
  insert() { return true; },
  update() { return true; },
  remove() { return true; }
});
