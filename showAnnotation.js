self.importScripts('https://jonudell.info/hlib/hlib.js', 'https://jonudell.info/hlib/showdown.js');

self.addEventListener('message', function (e) {
  var output = showAnnotation(e.data.anno, e.data.level);
  self.postMessage({
    id: e.data.cardId,
    output: output
  });
});
