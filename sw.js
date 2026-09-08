/* ──────────────────────────────────────────────────────────────────────────
 * TRR999 Service Worker — offline app shell
 * Caches static assets so the portal + modules load when the network drops.
 * Data sync (reads/writes) is handled separately by Firestore offline
 * persistence (IndexedDB); this SW only covers the static shell.
 *
 * NOTE: Service workers only run over https/localhost — when the app is opened
 * via file:// the registration is skipped (see index.html guard). Production on
 * GitHub Pages (https) gets full offline shell caching.
 * ────────────────────────────────────────────────────────────────────────── */
var CACHE='trr999-shell-v5';

// Same-origin app shell (relative to /project4/).
var SHELL=[
  './',
  './index.html',
  './glass.css',
  './glass-components.css',
  './manifest.json',
  './TRR999logo.png',
  './audit.js',
  './help.html',
  './trr.html',
  './project1/transport.html',
  './project2/index.html',
  './priceboard/index.html',
  './fleet_view/index.html',
  './attendance/index.html',
  './dashboard/index.html',
  './trr_gas/index.html',
  './audit/index.html',
  './spinwheel/index.html',
  './games/index.html',
  './tycoon/index.html',
  './ui-fx.css',
  './ui-fx.js'
];

self.addEventListener('install',function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      // addAll fails the whole install if any URL 404s; add individually instead.
      return Promise.all(SHELL.map(function(u){
        return c.add(u).catch(function(){ /* ignore missing */ });
      }));
    })
  );
});

self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ if(k!==CACHE)return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var url=new URL(req.url);

  // Never intercept Firebase / Google APIs — let the SDK manage its own offline.
  var host=url.hostname;
  if(host.indexOf('firestore.googleapis.com')>=0 ||
     host.indexOf('firebaseio.com')>=0 ||
     host.indexOf('googleapis.com')>=0 ||
     host.indexOf('google.com')>=0 ||
     host.indexOf('gstatic.com')>=0 && url.pathname.indexOf('/firebasejs/')>=0){
    return; // default network handling
  }

  // CDN assets (fonts, firebase SDK): cache-first, fill cache on first hit.
  if(url.origin!==self.location.origin){
    e.respondWith(
      caches.match(req).then(function(hit){
        return hit || fetch(req).then(function(res){
          var copy=res.clone();
          caches.open(CACHE).then(function(c){ c.put(req,copy); });
          return res;
        }).catch(function(){ return hit; });
      })
    );
    return;
  }

  // Same-origin: network-first (fresh when online), fall back to cache offline.
  e.respondWith(
    fetch(req).then(function(res){
      var copy=res.clone();
      caches.open(CACHE).then(function(c){ c.put(req,copy); });
      return res;
    }).catch(function(){
      return caches.match(req).then(function(hit){
        return hit || caches.match('./index.html');
      });
    })
  );
});
