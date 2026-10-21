!macro customHeader
  !system "echo 'Inputrix Custom NSIS Installer'"
!macroend

!macro customInit
  SetCtlColors $HWNDPARENT 0xFFFFFF 0x171719
!macroend

!macro customInstall
  CreateShortCut "$DESKTOP\Inputrix.lnk" "$INSTDIR\Inputrix.exe" "" "$INSTDIR\Inputrix.exe" 0
!macroend
