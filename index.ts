import * as hlib from '../../hlib/hlib' // this will be commented out in the shipping bundle

hlib.createUserInputForm(hlib.getById('userContainer'))

hlib.createGroupInputForm(hlib.getById('groupContainer'))

hlib.createFacetInputForm(hlib.getById('urlContainer'), 'url', 'URL of annotated document')

hlib.createFacetInputForm(hlib.getById('tagContainer'), 'tag', '')

hlib.createFacetInputForm(hlib.getById('anyContainer'), 'any', 'freetext search')

hlib.createFacetInputForm(hlib.getById('maxContainer'), 'max', 'max annotations to fetch')

hlib.createApiTokenInputForm(hlib.getById('tokenContainer'))

let facets = ['user', 'group', 'url', 'tag', 'any']
facets.forEach(facet => {
  if (hlib.gup(facet) !== '') {
    let inputElement = document.querySelector(`#${facet}Container input`) as HTMLInputElement
    inputElement.value = hlib.gup(facet)
  }
})

function getCSV () {
  search('csv')
}

function getHTML () {
  search('html')
}

function getJSON () {
  search('json')
}

function inputQuerySelector(query:string) : HTMLInputElement {
  return document.querySelector(query) as HTMLInputElement
}


function search (format:string) {
  let params:any = {
    user: inputQuerySelector('#userContainer input').value,
    group: hlib.getSelectedGroup(),
    url: inputQuerySelector('#urlContainer input').value,
    tag: inputQuerySelector('#tagContainer input').value,
    any: inputQuerySelector('#anyContainer input').value,
    max: inputQuerySelector('#maxContainer input').value,
    format: format
  }
  document.title = 'Hypothesis activity for the query ' + JSON.stringify(params)
  params = encodeURIComponent(JSON.stringify(params))
  var iframeUrl = `iframe.html?params=${params}`
  hlib.getById('iframe').setAttribute('src', iframeUrl)
}
