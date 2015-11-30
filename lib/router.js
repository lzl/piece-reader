FlowRouter.route('/', {
  name: 'reader',
  action: function() {
    BlazeLayout.render("app", {content: "reader", card: "readerPieces", clonesLoading: "readerClonesLoading", subsLoading: "readerSubsLoading"});
  }
});

FlowRouter.route('/follow', {
  name: 'follow',
  action: function(params, queryParams) {
    BlazeLayout.render("app", {content: "follow", clonesLoading: "buttonClonesLoading", subsLoading: "buttonSubsLoading"});
  }
});

FlowRouter.route('/following', {
  name: 'following',
  action: function() {
    BlazeLayout.render("app", {content: "following", card: "followingSubs", clonesLoading: "readerClonesLoading", subsLoading: "readerSubsLoading"});
  }
});
