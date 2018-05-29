self.importScripts('https://jonudell.info/hlib/hlib.bundle.js', 'https://jonudell.info/hlib/showdown.js')

self.addEventListener('message', function (e) {
  var output = hlib.showAnnotation(e.data.anno, e.data.level)
  self.postMessage({
    id: e.data.perUrlId,
    output: output
  })
})
