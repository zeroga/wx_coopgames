// Pixel bounds for a native scroll-view: never let it cover the fixed actions.
function frame(info, keyboardHeight) {
  const windowHeight = Number(info.windowHeight) || 680
  const keyboard = Math.max(0, Math.min(Number(keyboardHeight) || 0, windowHeight))
  return {keyboardHeight:keyboard, sheetHeight:Math.max(0, Math.floor(Math.min(windowHeight * .88, windowHeight - keyboard - 12)))}
}
function contentBounds(sheet, head, footer, gap) {
  if (!sheet || !head || !footer) return null
  const contentTop = Math.max(0, Math.min(sheet.height, head.bottom - sheet.top + gap))
  // Native scroll-view defaults to width:100%; left/right alone do not reduce it.
  const contentLeft = Math.max(0, Math.min(sheet.width, head.left - sheet.left))
  const contentWidth = Math.max(0, Math.min(head.width, sheet.width - contentLeft))
  return {contentLeft, contentWidth, contentTop, contentHeight:Math.max(0, footer.top - sheet.top - gap - contentTop)}
}
module.exports = {frame, contentBounds}
