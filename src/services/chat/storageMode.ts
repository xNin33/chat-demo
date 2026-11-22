const mobileDevice =
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const useBrowserAttachments = !__DEV_BUILD__ && mobileDevice
export const canChooseHistoryDirectory =
  !__DEV_BUILD__ &&
  !mobileDevice &&
  typeof Reflect.get(window, 'showDirectoryPicker') === 'function'
