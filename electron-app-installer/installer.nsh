; Lab fork: start the app again after an in-place update.
; electron-updater's quitAndInstall(true, true) passes --force-run, but the assisted
; installer (oneClick: false) ignores it in silent mode, so the app stayed closed after
; "Restart now". A second copy started by both paths exits on the single-instance lock.
!macro customInstall
  ${if} ${isUpdated}
    Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  ${endIf}
!macroend
