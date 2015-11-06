FlowRouter.route('/', {
  name: 'home',
  action: function() {
    BlazeLayout.render("app", {content: "reader", card: "readerPiecesWrapper"});
  }
});

FlowRouter.route('/follow', {
  name: 'follow',
  action: function(params, queryParams) {
    BlazeLayout.render("app", {content: "follow"});
  }
});

FlowRouter.route('/following', {
  name: 'following',
  action: function() {
    BlazeLayout.render("app", {content: "following", card: "followingSubsWrapper"});
  }
});
