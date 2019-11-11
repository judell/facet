import * as hlib from '../../hlib/hlib' // this will be commented out in the shipping bundle

const facets = ['user', 'group', 'url', 'wildcard_uri', 'tag', 'any'] as string[]
const settings = ['subjectUserTokens', 'expanded', 'searchReplies', 'exactTagSearch'] as string[]

if ( ! localStorage.getItem('h_settings') ) {
  hlib.settingsToLocalStorage(hlib.getSettings()) // initialize settings
}

hlib.getById('svgDefs').outerHTML = hlib.svgIcons

updateSettingsFromUrl() // incoming url params override remembered params

hlib.settingsToUrl(hlib.getSettings()) // add non-overridden remembered params to url

hlib.createUserInputForm(hlib.getById('userContainer'))

hlib.createGroupInputForm(hlib.getById('groupContainer'))
  .then( _ => {
    const selectId = 'groupsList'
    const groupsList = hlib.getById(selectId) as HTMLSelectElement
    const option = new Option('All','all')
    groupsList.insertBefore(option, groupsList.firstChild)
    groupsList.onchange = groupChangeHandler
    if (hlib.getSettings().group === 'all') {
      groupsList.selectedIndex = 0
    }
    function groupChangeHandler() {
      hlib.setSelectedGroup(selectId)
      hlib.getById('buttonHTML').click()
    }
  })

hlib.createUrlInputForm(hlib.getById('urlContainer'))

hlib.createWildcardUriInputForm(hlib.getById('wildcard_uriContainer'))

hlib.createTagInputForm(hlib.getById('tagContainer'), 'View/rename tags <a href="https://jonudell.info/h/TagRename/">here</a>')

hlib.createAnyInputForm(hlib.getById('anyContainer'), 'Freetext search')

hlib.createMaxInputForm(hlib.getById('maxContainer'), 'Approximate limit')

hlib.createApiTokenInputForm(hlib.getById('tokenContainer'))

hlib.createExactTagSearchCheckbox(hlib.getById('exactTagSearchContainer'))

hlib.createAddQuoteContextCheckbox(hlib.getById('addQuoteContextContainer'))

hlib.createExpandedCheckbox(hlib.getById('expandedContainer'))

function updateSettingsFromUrl() {
  const params = facets.concat(settings)
  params.forEach(param => {
    if (hlib.gup(param) !== '') {
      const value = decodeURIComponent(hlib.gup(param))
      hlib.updateSetting(param, value)
      hlib.settingsToLocalStorage(hlib.getSettings())
    }
  })
}

function getCSV () {
  search('csv')
}

function getHTML () {
  search('html')
}

function getJSON () {
  search('json')
}

function search (format:string) {
  let params:any = {}
  params = Object.assign(params, hlib.getSettings())
  params.format = format
  params._separate_replies = 'false'
  params.group = hlib.getSelectedGroup('groupsList')
  params.groupName = hlib.getSelectedGroupName('groupsList')
  const maxInput = document.querySelector('#maxForm') as HTMLInputElement
  params.max = maxInput.value ? maxInput.value : hlib.getDefaultSettings().max
  const sortByElement = hlib.getById('sortBy') as HTMLSelectElement
  const sortByOption = sortByElement[sortByElement.selectedIndex] as HTMLOptionElement
  params.sortBy = sortByOption.value
  document.title = 'Hypothesis activity for the query ' + JSON.stringify(params)
  params = encodeURIComponent(JSON.stringify(params))
  const iframeUrl = `iframe.html?params=${params}`
  hlib.getById('iframe').setAttribute('src', iframeUrl)
}

function dropHandler(e:DragEvent) {
  const target = e.target as HTMLInputElement
  target.focus()
  target.click()
  setTimeout( _ => {
    if (target.id === 'urlForm' || target.id === 'wildcard_uriForm') {
      if (target.id === 'wildcard_uriForm' && ! target.value.endsWith('/*') ) {
        target.value += '/*'
      }
      if (target.id === 'wildcard_uriForm' && ! target.value.startsWith('http') ) {
        target.value = `http://${target.value}`
      }
    }
  }, 0)
}

const activeFields = facets.filter(x => {return x !== 'group'})

activeFields.forEach(field => {
  const fieldElement = hlib.getById(`${field}Container`) as HTMLInputElement
  fieldElement.addEventListener('formUrlStorageSync', function (e) {
    getHTML()
  })
  fieldElement.addEventListener('clearInput', function (e) {
    getHTML()
  })
})

hlib.getById('sortBy').onchange = function() {
  getHTML()
}