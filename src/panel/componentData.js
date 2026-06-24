var HISTORY_LIMIT = 10;

export function createComponentData(update) {
  return {
    renders: 1,
    total: update.total || 0,
    exclusive: update.exclusive || 0,
    lastChanges: update.changes || [],
    history: [{
      timestamp: update.timestamp,
      exclusive: update.exclusive,
      total: update.total,
      changes: update.changes,
      propDiff: update.propDiff,
      commitId: update.commitId,
    }],
    maxExclusive: update.exclusive || 0,
    patterns: update.patterns || [],
    propDiff: update.propDiff || [],
    causeChain: update.causeChain || [],
    rootIndex: update.rootIndex ?? -1,
    rootCause: update.rootCause || null,
    predictions: update.predictions || [],
    confidence: update.confidence || null,
    score: update.score || 0,
  };
}

export function mergeComponentData(existing, update) {
  var newHistory = existing.history.concat([{
    timestamp: update.timestamp,
    exclusive: update.exclusive,
    total: update.total,
    changes: update.changes,
    propDiff: update.propDiff,
    commitId: update.commitId,
  }]);
  if (newHistory.length > HISTORY_LIMIT) newHistory.shift();

  return {
    renders: existing.renders + 1,
    total: existing.total + (update.total || 0),
    exclusive: existing.exclusive + (update.exclusive || 0),
    lastChanges: update.changes || [],
    history: newHistory,
    maxExclusive: Math.max(existing.maxExclusive, update.exclusive || 0),
    patterns: update.patterns || [],
    propDiff: update.propDiff || [],
    causeChain: update.causeChain || [],
    rootIndex: update.rootIndex ?? -1,
    rootCause: update.rootCause || null,
    predictions: update.predictions || [],
    confidence: update.confidence || null,
    score: update.score || 0,
  };
}

var initialState = {};

export function componentsReducer(state, action) {
  switch (action.type) {
    case "UPDATE":
      var next = {};
      var updates = action.updates;
      for (var i = 0; i < updates.length; i++) {
        var update = updates[i];
        var name = update.name;
        if (!name) continue;
        if (state[name]) {
          next[name] = mergeComponentData(state[name], update);
        } else {
          next[name] = createComponentData(update);
        }
      }
      return next;
    case "RESET":
      return {};
    default:
      return state;
  }
}
