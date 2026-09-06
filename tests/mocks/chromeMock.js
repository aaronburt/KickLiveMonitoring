export function createChromeMock() {
  const store = new Map();
  const alarmsMap = new Map();
  const notificationsMap = new Map();
  const createdTabs = [];
  let badgeText = '';
  let badgeBackgroundColor = '';
  let badgeTextColor = '';

  function createEventDispatcher() {
    const listeners = new Set();
    return {
      addListener(fn) {
        if (typeof fn === 'function') {
          listeners.add(fn);
        }
      },
      removeListener(fn) {
        listeners.delete(fn);
      },
      hasListener(fn) {
        if (!fn) return listeners.size > 0;
        return listeners.has(fn);
      },
      async trigger(...args) {
        for (const listener of listeners) {
          await listener(...args);
        }
      },
      clear() {
        listeners.clear();
      },
    };
  }

  const onAlarm = createEventDispatcher();
  const onNotificationClicked = createEventDispatcher();
  const onContextMenuClicked = createEventDispatcher();
  const onInstalled = createEventDispatcher();
  const onStartup = createEventDispatcher();
  const onMessage = createEventDispatcher();
  const onStorageChanged = createEventDispatcher();

  const mock = {
    storage: {
      onChanged: onStorageChanged,
      local: {
        get(keys, callback) {
          let result = {};
          if (keys === null || keys === undefined) {
            for (const [k, v] of store.entries()) {
              result[k] = v;
            }
          } else if (typeof keys === 'string') {
            if (store.has(keys)) {
              result[keys] = store.get(keys);
            }
          } else if (Array.isArray(keys)) {
            for (const key of keys) {
              if (store.has(key)) {
                result[key] = store.get(key);
              }
            }
          } else if (typeof keys === 'object') {
            for (const key of Object.keys(keys)) {
              result[key] = store.has(key) ? store.get(key) : keys[key];
            }
          }
          if (typeof callback === 'function') {
            callback(result);
          }
          return Promise.resolve(result);
        },
        set(items, callback) {
          const changes = {};
          if (items && typeof items === 'object') {
            for (const [key, value] of Object.entries(items)) {
              const oldValue = store.get(key);
              const newValue = JSON.parse(JSON.stringify(value));
              store.set(key, newValue);
              changes[key] = { oldValue, newValue };
            }
          }
          if (typeof callback === 'function') {
            callback();
          }
          onStorageChanged.trigger(changes, 'local');
          return Promise.resolve();
        },
        remove(keys, callback) {
          const changes = {};
          const keysArray = Array.isArray(keys) ? keys : [keys];
          for (const key of keysArray) {
            const oldValue = store.get(key);
            store.delete(key);
            changes[key] = { oldValue, newValue: undefined };
          }
          if (typeof callback === 'function') {
            callback();
          }
          onStorageChanged.trigger(changes, 'local');
          return Promise.resolve();
        },
        clear(callback) {
          store.clear();
          if (typeof callback === 'function') {
            callback();
          }
          onStorageChanged.trigger({}, 'local');
          return Promise.resolve();
        },
      },
      sync: {
        get(keys, callback) {
          return mock.storage.local.get(keys, callback);
        },
        set(items, callback) {
          return mock.storage.local.set(items, callback);
        },
        remove(keys, callback) {
          return mock.storage.local.remove(keys, callback);
        },
        clear(callback) {
          return mock.storage.local.clear(callback);
        },
      },
    },
    contextMenus: {
      create(props, callback) {
        if (typeof callback === 'function') callback();
      },
      removeAll(callback) {
        if (typeof callback === 'function') callback();
      },
      onClicked: onContextMenuClicked,
    },
    alarms: {
      create(name, alarmInfo) {
        alarmsMap.set(name, {
          name,
          periodInMinutes: alarmInfo?.periodInMinutes || 1,
          delayInMinutes: alarmInfo?.delayInMinutes || 1,
          scheduledTime: Date.now() + ((alarmInfo?.delayInMinutes || 1) * 60000),
        });
      },
      clear(name, callback) {
        const existed = alarmsMap.delete(name);
        if (typeof callback === 'function') {
          callback(existed);
        }
        return Promise.resolve(existed);
      },
      clearAll(callback) {
        const count = alarmsMap.size;
        alarmsMap.clear();
        if (typeof callback === 'function') {
          callback(count > 0);
        }
        return Promise.resolve(count > 0);
      },
      get(name, callback) {
        const alarm = alarmsMap.get(name) || null;
        if (typeof callback === 'function') {
          callback(alarm);
        }
        return Promise.resolve(alarm);
      },
      getAll(callback) {
        const all = Array.from(alarmsMap.values());
        if (typeof callback === 'function') {
          callback(all);
        }
        return Promise.resolve(all);
      },
      onAlarm,
    },
    notifications: {
      create(notificationId, options, callback) {
        const id = notificationId || `notif_${Date.now()}_${Math.random()}`;
        notificationsMap.set(id, options);
        if (typeof callback === 'function') {
          callback(id);
        }
        return Promise.resolve(id);
      },
      clear(notificationId, callback) {
        const existed = notificationsMap.delete(notificationId);
        if (typeof callback === 'function') {
          callback(existed);
        }
        return Promise.resolve(existed);
      },
      getAll(callback) {
        const result = {};
        for (const [k, v] of notificationsMap.entries()) {
          result[k] = v;
        }
        if (typeof callback === 'function') {
          callback(result);
        }
        return Promise.resolve(result);
      },
      onClicked: onNotificationClicked,
    },
    tabs: {
      create(properties, callback) {
        const tab = {
          id: createdTabs.length + 1,
          url: properties?.url || '',
          active: Boolean(properties?.active),
        };
        createdTabs.push(tab);
        if (typeof callback === 'function') {
          callback(tab);
        }
        return Promise.resolve(tab);
      },
      query(queryInfo, callback) {
        const matching = createdTabs.filter((t) => {
          if (queryInfo?.active !== undefined && t.active !== queryInfo.active) {
            return false;
          }
          return true;
        });
        if (typeof callback === 'function') {
          callback(matching);
        }
        return Promise.resolve(matching);
      },
    },
    action: {
      setBadgeText(details, callback) {
        badgeText = details?.text || '';
        if (typeof callback === 'function') {
          callback();
        }
        return Promise.resolve();
      },
      setBadgeBackgroundColor(details, callback) {
        badgeBackgroundColor = details?.color || '';
        if (typeof callback === 'function') {
          callback();
        }
        return Promise.resolve();
      },
      setBadgeTextColor(details, callback) {
        badgeTextColor = details?.color || '';
        if (typeof callback === 'function') {
          callback();
        }
        return Promise.resolve();
      },
      getBadgeText() {
        return badgeText;
      },
      getBadgeBackgroundColor() {
        return badgeBackgroundColor;
      },
      getBadgeTextColor() {
        return badgeTextColor;
      },
    },
    runtime: {
      onInstalled,
      onStartup,
      onMessage,
      sendMessage(message, callback) {
        let responded = false;
        let responseValue = undefined;

        const sendResponse = (resp) => {
          responded = true;
          responseValue = resp;
          if (typeof callback === 'function') {
            callback(resp);
          }
        };

        if (onMessage.hasListener()) {
          onMessage.trigger(message, { id: 'test-sender' }, sendResponse);
        } else if (typeof callback === 'function') {
          callback(undefined);
        }
        return Promise.resolve(responseValue);
      },
    },
    _internal: {
      store,
      alarmsMap,
      notificationsMap,
      createdTabs,
      reset() {
        store.clear();
        alarmsMap.clear();
        notificationsMap.clear();
        createdTabs.length = 0;
        badgeText = '';
        badgeBackgroundColor = '';
        badgeTextColor = '';
        onAlarm.clear();
        onNotificationClicked.clear();
        onInstalled.clear();
        onStartup.clear();
        onMessage.clear();
      },
    },
  };

  return mock;
}

export function installGlobalChromeMock() {
  const mock = createChromeMock();
  globalThis.chrome = mock;
  return mock;
}
