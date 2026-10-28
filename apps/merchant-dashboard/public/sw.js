/*
 * Zimos dashboard — the service worker for device notifications, and nothing else.
 *
 * Registered only by src/lib/push (VITE_PUSH_ENABLED), once a person turns
 * notifications on for this browser. It listens to push, notificationclick and
 * pushsubscriptionchange (plus install/activate, to take over at once). It has
 * no fetch handler and touches no cache, so it never serves a page or a file:
 * every load of the dashboard comes from the network, as without it.
 * src/lib/push/sw.test.ts fails if a fetch handler, a cache or imported
 * scripts ever appear here.
 *
 * What a push carries (the API's notifications/push/pushPayload.js, an
 * allowlist): { v, type, title, body, url, tag, count }. No customer data.
 */

var ICON = "/brand/zimos-icon-192.png";

/** A path inside the dashboard, or "/" for anything else (another site, "//host", a script URL). */
function safePath(url) {
  if (typeof url !== "string" || url.length > 300 || url.charAt(0) !== "/" || url.charAt(1) === "/" || url.charAt(1) === "\\") return "/";
  try {
    var resolved = new URL(url, self.location.origin);
    if (resolved.origin !== self.location.origin) return "/";
    return resolved.pathname + resolved.search;
  } catch {
    return "/";
  }
}

function readPayload(event) {
  try {
    var data = event.data ? event.data.json() : null;
    if (data && typeof data === "object" && typeof data.title === "string") return data;
  } catch {
    /* not JSON: shown as a plain notice below */
  }
  return null;
}

function windows() {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true });
}

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

/*
 * Always shown: Safari ends a subscription that gets pushes without a
 * notification, and Chrome shows its own "updated in the background" notice
 * instead. While a dashboard window is open and in front, it is shown without
 * a sound (decision 8's fallback): the page itself already tells.
 */
self.addEventListener("push", function (event) {
  var payload = readPayload(event);
  var title = payload ? payload.title : "Zimos";
  var count = payload && typeof payload.count === "number" && payload.count > 0 ? payload.count : 1;
  var tag = payload && typeof payload.tag === "string" && payload.tag ? payload.tag : "zimos";
  event.waitUntil(
    windows().then(function (list) {
      var inFront = list.some(function (client) {
        return client.focused === true && client.visibilityState === "visible";
      });
      return self.registration.showNotification(title, {
        body: payload && typeof payload.body === "string" ? payload.body : "",
        tag: tag,
        renotify: true,
        silent: inFront,
        icon: ICON,
        dir: "auto",
        data: { url: safePath(payload ? payload.url : "/"), type: payload ? payload.type : null, count: count },
      });
    })
  );
});

/* Opens the dashboard on the notification's page: an open window is brought forward and told where to go; otherwise a new one opens there. */
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = safePath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    windows().then(function (list) {
      var target = list.filter(function (client) {
        return client.focused;
      })[0] || list[0];
      if (!target) return self.clients.openWindow(url);
      return Promise.resolve(target.focus ? target.focus() : target).then(function () {
        target.postMessage({ type: "zimos.push.open", url: url });
      });
    })
  );
});

/* The browser replaced the subscription: subscribe again with the same key, and tell open windows to send the new one to the API. */
self.addEventListener("pushsubscriptionchange", function (event) {
  var old = event.oldSubscription;
  var key = old && old.options ? old.options.applicationServerKey : null;
  var renewed = event.newSubscription
    ? Promise.resolve(event.newSubscription)
    : key
      ? self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
      : Promise.resolve(null);
  event.waitUntil(
    renewed
      .catch(function () {
        return null;
      })
      .then(function () {
        return windows();
      })
      .then(function (list) {
        list.forEach(function (client) {
          client.postMessage({ type: "zimos.push.changed" });
        });
      })
  );
});
