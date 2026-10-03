// Reuse an existing destination instead of stacking the same AW module.
function visit(route, query) {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  const index = pages.findIndex(p => p.route === route)
  const current = pages.length - 1
  if (index >= 0) {
    const destination = pages[index]
    if (query && typeof destination.receiveNavigation === 'function') destination.receiveNavigation(query)
    if (index < current) wx.navigateBack({ delta: current - index })
    return
  }
  const suffix = Object.keys(query || {}).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(query[k])).join('&')
  wx.navigateTo({ url: '/' + route + (suffix ? '?' + suffix : '') })
}
module.exports = { visit }
