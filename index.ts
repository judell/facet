import * as hlib from '../../hlib/hlib' // this will be commented out in the shipping bundle

if ( ! localStorage.getItem('h_settings') ) {
  hlib.settingsToLocalStorage(hlib.getSettings()) // initialize settings
}

updateSettingsFromUrl() // incoming url params override remembered params

hlib.settingsToUrl(hlib.getSettings()) // add non-overridden remembered params to url

hlib.createUserInputForm(hlib.getById('userContainer'))

function groupChangeHandler() {
  hlib.setSelectedGroup()
  hlib.getById('buttonHTML').click()
}

hlib.createGroupInputForm(hlib.getById('groupContainer'))
  .then( _ => {
    let select = hlib.getById('groupsList')
    select.onchange = function() {
      hlib.getById('buttonHTML').click()
    }
    let option = new Option('All','all')
    select.insertBefore(option, select.firstChild)
    let groupsList = hlib.getById('groupsList')
    groupsList.setAttribute('onchange', 'groupChangeHandler()')
  
  })

hlib.createUrlInputForm(hlib.getById('urlContainer'))

hlib.createWildcardUriInputForm(hlib.getById('wildcard_uriContainer'))

hlib.createTagInputForm(hlib.getById('tagContainer'))

hlib.createAnyInputForm(hlib.getById('anyContainer'))

hlib.createMaxInputForm(hlib.getById('maxContainer'))

hlib.createSearchRepliesCheckbox(hlib.getById('searchRepliesContainer'))

hlib.createExactTagSearchCheckbox(hlib.getById('exactTagSearchContainer'))

hlib.createExpandedCheckbox(hlib.getById('expandedContainer'))

const _subjectUserTokens = localStorage.getItem('h_subjectUsers')
let subjectUserTokens:any = {} 
if (_subjectUserTokens) {
  subjectUserTokens = JSON.parse(_subjectUserTokens) 
}

function subjectUserHiddenTokens() {
  let subjectUserHiddenTokens = Object.assign( {}, subjectUserTokens)
  if (Object.keys(subjectUserHiddenTokens).length) {
    Object.keys(subjectUserHiddenTokens).forEach( function(key) {
      subjectUserHiddenTokens[key] = '***'
    })
  } else {
    subjectUserHiddenTokens = {"user1":"***", "user2":"***"}
  }
  return JSON.stringify(subjectUserHiddenTokens)
}

const subjectUserTokenArgs = {
  element: hlib.getById('subjectsContainer'),
  name: 'subject user tokens',
  id: 'subjectUserTokens',
  value: `{}`,
  onchange: 'saveSubjectUserTokens',
  type: '',
  msg: ''
}

hlib.createNamedInputForm(subjectUserTokenArgs)
let subjectUserTokensForm = document.querySelector('#subjectsContainer .subjectUserTokensForm input') as HTMLInputElement
subjectUserTokensForm.value = subjectUserHiddenTokens()

function saveSubjectUserTokens() {
  let subjectUserTokensForm = document.querySelector('#subjectsContainer .subjectUserTokensForm input') as HTMLInputElement
  subjectUserTokens = JSON.parse(subjectUserTokensForm.value)
  hlib.setLocalStorageFromForm('subjectUserTokensForm', 'h_subjectUsers')
  subjectUserTokensForm.value = subjectUserHiddenTokens()
  }

hlib.createApiTokenInputForm(hlib.getById('tokenContainer'))

function updateSettingsFromUrl() {
  const facets = ['user', 'group', 'url', 'wildcard_uri', 'tag', 'any']
  const settings = ['max', 'subjectUserTokens', 'expanded', 'searchReplies', 'exactTagSearch']
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
  const settings = hlib.getSettings()
  let params:any = {}
  params = Object.assign(params, hlib.getSettings())
  params['format'] = format
  params['_separate_replies'] = settings.searchReplies
  params['group'] = hlib.getSelectedGroup('groupsList')
  document.title = 'Hypothesis activity for the query ' + JSON.stringify(params)
  params = encodeURIComponent(JSON.stringify(params))
  const iframeUrl = `iframe.html?params=${params}`
  hlib.getById('iframe').setAttribute('src', iframeUrl)
}



