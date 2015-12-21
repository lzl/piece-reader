Template.alertNewPieceWrapper.onCreated(function () {
  const instance = this;
  instance.state = new ReactiveDict();
  instance.state.setDefault({
    count: 0
  })

  instance.autorun(() => {
    const timestamp = Session.get('lastestRefreshTimestamp');
    const count = LocalPieces.find({createdAt: {$gt: timestamp}}).count();
    instance.state.set('count', count);
  })
})
Template.alertNewPieceWrapper.helpers({
  hasPiece() {
    const timestamp = Session.get('lastestRefreshTimestamp');
    return LocalPieces.findOne({createdAt: {$gt: timestamp}});
  },
  count() {
    const instance = Template.instance();
    return instance.state.get('count');
  }
})

Template.alertNewPiece.helpers({
  text() {
    const instance = Template.instance();
    const count = instance.data.count;
    if (count > 1) {
      return `${count} new pieces`;
    } else {
      return "1 new piece";
    }
  }
})
Template.alertNewPiece.events({
  'click [data-action=refresh]': (event, instance) => {
    event.preventDefault();
    Session.set('lastestRefreshTimestamp', new Date());
    if (FlowRouter.current().route.name === 'reader') {
      $("html, body").animate({ scrollTop: 0 }, "slow");
    } else {
      FlowRouter.go('/');
    }
  }
})
