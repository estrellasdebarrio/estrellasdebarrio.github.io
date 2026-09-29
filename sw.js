/* ============================================================================
   Service worker — Liga de Fútbol Estrellas de Barrio 2026

   Lo que hace que la plataforma se pueda instalar como app y abra aunque no
   haya señal en la cancha.

   REGLA IMPORTANTE: la página SIEMPRE se pide primero a internet y solo se usa
   la copia guardada si la red falla. Es al revés de lo que hace un service
   worker típico, y es a propósito: así una versión nueva de index.html llega
   apenas se publica, sin quedar pegado en una versión vieja.

   Lo que NUNCA se guarda en caché: las llamadas a Firestore. Los datos del
   campeonato tienen que venir siempre en vivo.
   ========================================================================== */

var CACHE = 'estrellas-2026-v2';
var BASICOS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', function(e){
  /* La versión nueva toma el control de inmediato, sin esperar a que se
     cierren todas las pestañas. */
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(BASICOS.map(function(u){
        return c.add(u).catch(function(){ /* si alguno falla, no importa */ });
      }));
    })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(llaves){
      return Promise.all(llaves.map(function(k){
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function esDeFirebase(url){
  return /firestore\.googleapis\.com|firebaseio|googleapis\.com|gstatic\.com/.test(url);
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;

  /* Datos del campeonato y SDK de Firebase: siempre a la red, sin caché. */
  if (esDeFirebase(req.url)) return;

  /* Solo se administra lo que vive en este mismo sitio. */
  if (new URL(req.url).origin !== self.location.origin) return;

  /* La página y los archivos del sitio se piden SIN usar la caché del
     navegador: así una versión recién publicada llega en la primera recarga y
     no queda escondida detrás de una copia vieja. */
  var esNavegacion = req.mode === 'navigate' || /\.(html|json|js|css)$/.test(new URL(req.url).pathname) ||
                     new URL(req.url).pathname.replace(/\/$/, '') === '';

  e.respondWith(
    fetch(esNavegacion ? new Request(req.url, { cache: 'no-store', credentials: 'same-origin' }) : req).then(function(resp){
      if (resp && resp.status === 200 && resp.type === 'basic'){
        var copia = resp.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copia); });
      }
      return resp;
    }).catch(function(){
      /* Sin señal: se entrega la última copia guardada. */
      return caches.match(req).then(function(hit){
        return hit || caches.match('./index.html');
      });
    })
  );
});
