const { Router } = require('express');
const {
  apiFetchLikedUser,
  apiFetchUserArticles,
  apiFetchSuggestedArticles,
  apiFetchFollowedArticles,
  apiFetchFollowedUser,
} = require('../../util/api');
const { userCollection } = require('../../util/firebase');
const { setPrivateCacheHeader } = require('../../middleware/cache');
const follow = require('./follow');
const bookmark = require('./bookmark');

const router = Router();

router.use(follow);
router.use(bookmark);

function filterArticleList(list) {
  return list.map(i => {
    const { referrer, url: originalUrl, user, ts } = i;
    const url = originalUrl ? originalUrl.toLowerCase() : undefined;
    return {
      referrer,
      url: referrer && referrer.toLowerCase() === url ? undefined : originalUrl,
      user,
      ts,
    };
  });
}

async function getFollowedUserListInfo(req) {
  const [{ data }, userDoc, { data: apiData }] = await Promise.all([
    apiFetchLikedUser(req),
    userCollection.doc(req.session.user).get(),
    apiFetchFollowedUser(req),
  ]);
  const userSet = new Set(data.list);
  const unfollowedUserSet = new Set();
  const { followedUsers = [], unfollowedUsers = [] } = userDoc.data();
  followedUsers.forEach(u => userSet.add(u));
  unfollowedUsers.forEach(u => {
    userSet.delete(u);
    unfollowedUserSet.add(u);
  });
  if (apiData.list) {
    const apiFollowed = apiData.list.filter(a => a.isFollowed);
    const apiUnfollowed = apiData.list.filter(a => !a.isFollowed);
    apiFollowed.forEach(u => userSet.add(u.id));
    apiUnfollowed.forEach(u => {
      userSet.delete(u.id);
      unfollowedUserSet.add(u.id);
    });
  }
  return {
    followedUsers: Array.from(userSet).sort(),
    unfollowedUsers: Array.from(unfollowedUserSet).sort(),
  };
}

router.get('/reader/index', async (req, res, next) => {
  try {
    setPrivateCacheHeader(res);
    if (!req.session.user) {
      res.sendStatus(403);
      return;
    }
    const { followedUsers, unfollowedUsers } = await getFollowedUserListInfo(
      req
    );
    res.json({ list: followedUsers, unfollowedUsers });
  } catch (err) {
    next(err);
  }
});

router.get('/reader/works/suggest', async (req, res, next) => {
  try {
    const { data } = await apiFetchSuggestedArticles();
    let list = data.editorial.concat(data.pick); // only get editorial and pick list, ignore mostLike
    list = list.map(url => ({ referrer: url }));
    res.set('Cache-Control', 'public, max-age=600');
    res.json({ list });
  } catch (err) {
    next(err);
  }
});

router.get('/reader/works/followed', async (req, res, next) => {
  try {
    setPrivateCacheHeader(res);
    if (!req.session.user) {
      res.sendStatus(403);
      return;
    }
    const { after, before, limit = 40 } = req.query;
    /* TODO: fix this HACK on hardcode 20 articles/user limit */
    const { followedUsers: users } = await getFollowedUserListInfo(req);
    if (!users || !users.length) {
      res.json({ list: [] });
      return;
    }
    const { data } = await apiFetchFollowedArticles(users, {
      after,
      before,
      limit,
    });
    data.list.sort((a, b) => b.ts - a.ts).splice(limit);
    res.json({ list: data.list });
  } catch (err) {
    next(err);
  }
});

router.get('/reader/user/:user/works', async (req, res, next) => {
  try {
    setPrivateCacheHeader(res);
    if (!req.session.user) {
      res.sendStatus(403);
      return;
    }
    const { limit = 20 } = req.query;
    const { data } = await apiFetchUserArticles(req.params.user, limit);
    let { list } = data;
    list = filterArticleList(list);
    res.json({ list });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
