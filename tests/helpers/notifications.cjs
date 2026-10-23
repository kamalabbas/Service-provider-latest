// Native boundary shared by notification and root/session integration tests.
function notifications(options = {}) {
  const calls = [], history = {}, listeners = {}, maxima = {};
  let lastResponse = options.lastResponse ?? null;
  let permission = options.permission ?? { status: 'granted', granted: true, canAskAgain: true };
  let handler;
  const subscribe = (kind, callback) => {
    if (options.listenerError === kind) throw new Error('Native listener unavailable');
    const active = listeners[kind] ??= new Set();
    active.add(callback);
    (history[kind] ??= []).push(callback);
    maxima[kind] = Math.max(maxima[kind] ?? 0, active.size);
    return { remove: () => active.delete(callback) };
  };
  const Notifications = {
    AndroidImportance: { MAX: 5 },
    IosAuthorizationStatus: { PROVISIONAL: 3, EPHEMERAL: 4 },
    setNotificationHandler: value => { handler = value; },
    addNotificationReceivedListener: callback => subscribe('received', callback),
    addNotificationResponseReceivedListener: callback => subscribe('response', callback),
    addPushTokenListener: callback => subscribe('token', callback),
    getLastNotificationResponse: () => {
      calls.push(['lastResponse']);
      if (options.lastResponseError) throw new Error('Native response unavailable');
      return lastResponse;
    },
    clearLastNotificationResponse: () => {
      calls.push(['clearResponse']);
      if (options.clearResponseError) throw new Error('Native response unavailable');
      lastResponse = null;
    },
    setNotificationChannelAsync: async (...args) => {
      calls.push(['channel', ...args]);
      if (options.channelError) throw new Error('Native channel unavailable');
    },
    getPermissionsAsync: async () => {
      calls.push(['permission']);
      if (options.permissionError) throw new Error('Native permission unavailable');
      return options.getPermission ? options.getPermission() : permission;
    },
    requestPermissionsAsync: async () => {
      calls.push(['requestPermission']);
      if (options.requestError) throw new Error('Native permission request failed');
      permission = options.requestResult ?? { status: 'denied', granted: false, canAskAgain: false };
      return permission;
    },
    getExpoPushTokenAsync: async params => {
      calls.push(['expoToken', params]);
      return options.getToken ? options.getToken(params) : { data: 'synthetic-expo-token' };
    },
  };
  return {
    Notifications,
    Constants: {
      __esModule: true,
      ExecutionEnvironment: { StoreClient: 'storeClient' },
      default: {
        executionEnvironment: options.expoGo ? 'storeClient' : 'standalone',
        expoConfig: { extra: { eas: { projectId: options.missingProject ? undefined : 'existing-project' } } },
      },
    },
    Device: { isDevice: options.physical !== false },
    AppState: { addEventListener: (_event, callback) => subscribe('appState', callback) },
    calls, history, maxima,
    get handler() { return handler; },
    count: kind => calls.filter(([name]) => name === kind).length,
    active: kind => listeners[kind]?.size ?? 0,
    setPermission: value => { permission = value; },
    emit: (kind, value) => {
      if (kind === 'response') lastResponse = value;
      for (const callback of listeners[kind] ?? []) callback(value);
    },
  };
}

const response = (id = 'notification-1', data = {}) => ({
  actionIdentifier: 'default',
  notification: { request: { identifier: id, content: { data } } },
});

module.exports = { notifications, response };
