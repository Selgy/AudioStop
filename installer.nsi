!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

; Version is passed from the workflow as a command line parameter
; If VERSION is not defined via command line, use a default
!ifndef VERSION
  !define VERSION "2.0.1"
!endif

; Product information
!define PRODUCT_NAME "AudioStop"
!define PRODUCT_PUBLISHER "Selgy"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

Name "${PRODUCT_NAME} for Premiere Pro"
OutFile "AudioStop-${VERSION}-Setup.exe"

; Icon - commented out for now, add icon.ico to root folder if needed
; !define MUI_ICON "icon.ico"
; !define MUI_UNICON "icon.ico"

; Request application privileges for Windows Vista and higher
RequestExecutionLevel admin

; Branding
BrandingText "${PRODUCT_NAME} v${VERSION} - ${PRODUCT_PUBLISHER}"

; Interface Settings
!define MUI_ABORTWARNING
!define MUI_HEADERIMAGE
!define MUI_WELCOMEPAGE_TITLE "Welcome to ${PRODUCT_NAME} Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of ${PRODUCT_NAME} for Adobe Premiere Pro.$\r$\n$\r$\n${PRODUCT_NAME} automatically mutes selected applications when you play your timeline in Premiere Pro.$\r$\n$\r$\nClick Next to continue."

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_TITLE "Installation Complete"
!define MUI_FINISHPAGE_TEXT "${PRODUCT_NAME} has been successfully installed!$\r$\n$\r$\nThe extension will be available in Adobe Premiere Pro under:$\r$\nWindow > Extensions > AudioStop$\r$\n$\r$\nPlease restart Premiere Pro if it's currently running."
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Function .onInit
    ; Force installation to Adobe CEP extensions folder
    StrCpy $INSTDIR "$PROGRAMFILES64\Common Files\Adobe\CEP\extensions\com.selgy.audiostop"
    DetailPrint "Installation directory set to: $INSTDIR"
FunctionEnd

Section "Install ${PRODUCT_NAME}" SEC01
  DetailPrint "Installing ${PRODUCT_NAME} for Premiere Pro..."
  DetailPrint "Working directory: $EXEDIR"
  DetailPrint "Installation target: $INSTDIR"
  
  # Warn user about potentially running processes
  MessageBox MB_OKCANCEL|MB_ICONINFORMATION "Please close Adobe Premiere Pro and ${PRODUCT_NAME} if they're currently running before continuing installation. Click OK to proceed." IDOK cleanup_install IDCANCEL abort_install
  
  abort_install:
    DetailPrint "Installation aborted by user"
    Abort
  
  cleanup_install:
  # Kill any running AudioStop processes
  DetailPrint "Stopping ${PRODUCT_NAME} processes..."
  nsExec::ExecToLog 'taskkill /F /IM audio_control_server.exe'
  
  # Remove any existing installation first  
  DetailPrint "Cleaning up previous installation..."
  RMDir /r "$INSTDIR"
  
  # Create directory structure
  CreateDirectory "$INSTDIR"
  DetailPrint "Created installation directory: $INSTDIR"
  
  # Install CEP extension files in main directory
  SetOutPath "$INSTDIR"
  DetailPrint "Installing CEP extension..."
  
  # Install CEP extension files - copy entire cep folder content
  DetailPrint "Installing CEP extension files..."
  DetailPrint "Copying CEP extension to $INSTDIR..."
  SetOutPath "$INSTDIR"
  
  # Use NSIS error handling - if files don't exist, this will fail
  ClearErrors
  File /r "dist\cep\*.*"
  
  # Check if file copy was successful
  ${If} ${Errors}
    DetailPrint "ERROR: Failed to copy CEP extension files from dist\cep\"
    DetailPrint "Installation cannot continue without CEP extension files"
    MessageBox MB_OK|MB_ICONSTOP "Installation failed: CEP extension files not found or could not be copied."
    Abort
  ${Else}
    DetailPrint "CEP extension files copied successfully"
  ${EndIf}
  
  # Final verification of installation
  DetailPrint "Performing final installation verification..."
  
  # Check for essential CEP files
  IfFileExists "$INSTDIR\CSXS\manifest.xml" manifest_ok manifest_missing
  manifest_ok:
    DetailPrint "✓ CEP manifest.xml found"
    Goto check_exec_final
  manifest_missing:
    DetailPrint "❌ CRITICAL ERROR: CEP manifest.xml not found - extension will not work!"
    MessageBox MB_OK|MB_ICONSTOP "Installation verification failed: CEP manifest missing."
    Abort
    
  check_exec_final:
    IfFileExists "$INSTDIR\exec\audio_control_server.exe" final_ok final_missing
  final_ok:
    DetailPrint "✓ Python executable found"
    DetailPrint "✅ Installation completed successfully!"
    DetailPrint "Extension installed at: $INSTDIR"
    DetailPrint "The extension should now be available in Adobe Premiere Pro"
    Goto installation_done
  final_missing:
    DetailPrint "❌ CRITICAL ERROR: Python executable missing after installation!"
    MessageBox MB_OK|MB_ICONSTOP "Installation verification failed: Python executable is missing. Please try reinstalling."
    Abort
    
  installation_done:
  
  # Write uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  
  # Write registry keys for Add/Remove Programs
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\exec\audio_control_server.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoModify" 1
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoRepair" 1
  
  # Calculate and write installation size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "EstimatedSize" "$0"
  
  DetailPrint "Uninstaller created and registered"
SectionEnd

Section "Enable Debugging for Adobe CEP"
  DetailPrint "Enabling CEP debugging mode..."
  WriteRegStr HKCU "Software\Adobe\CSXS.6" "PlayerDebugMode" "1"
  WriteRegStr HKCU "Software\Adobe\CSXS.7" "PlayerDebugMode" "1"
  WriteRegStr HKCU "Software\Adobe\CSXS.8" "PlayerDebugMode" "1"
  WriteRegStr HKCU "Software\Adobe\CSXS.9" "PlayerDebugMode" "1"
  WriteRegStr HKCU "Software\Adobe\CSXS.10" "PlayerDebugMode" "1"
  WriteRegStr HKCU "Software\Adobe\CSXS.11" "PlayerDebugMode" "1"
  WriteRegStr HKCU "Software\Adobe\CSXS.12" "PlayerDebugMode" "1"
  DetailPrint "✓ CEP debugging mode enabled"
SectionEnd

Section "Uninstall"
  DetailPrint "Uninstalling ${PRODUCT_NAME}..."
  
  # Stop any running processes
  DetailPrint "Stopping ${PRODUCT_NAME} processes..."
  nsExec::ExecToLog 'taskkill /F /IM audio_control_server.exe'
  Sleep 1000
  
  # Remove all extension files
  DetailPrint "Removing extension files..."
  Delete "$INSTDIR\Uninstall.exe"
  Delete "$INSTDIR\exec\audio_control_server.exe"
  RMDir /r "$INSTDIR\exec"
  RMDir /r "$INSTDIR\js"
  RMDir /r "$INSTDIR\jsx"
  RMDir /r "$INSTDIR\assets"
  RMDir /r "$INSTDIR\CSXS"
  RMDir /r "$INSTDIR\background"
  RMDir /r "$INSTDIR\main"
  Delete "$INSTDIR\*.*"
  RMDir "$INSTDIR"
  
  # Remove user config (optional - ask user)
  MessageBox MB_YESNO "Do you want to remove your ${PRODUCT_NAME} configuration? (This will reset your muted applications list)" IDYES remove_config IDNO skip_config
  remove_config:
    DetailPrint "Removing user configuration..."
    RMDir /r "$APPDATA\AudioStop"
  skip_config:
  
  # Remove CEP debugging registry entries (optional - ask user)
  MessageBox MB_YESNO "Do you want to disable CEP debug mode? (This was enabled during installation)" IDYES remove_debug IDNO skip_debug
  remove_debug:
    DetailPrint "Removing CEP debugging registry entries..."
    DeleteRegValue HKCU "Software\Adobe\CSXS.6" "PlayerDebugMode"
    DeleteRegValue HKCU "Software\Adobe\CSXS.7" "PlayerDebugMode"
    DeleteRegValue HKCU "Software\Adobe\CSXS.8" "PlayerDebugMode"
    DeleteRegValue HKCU "Software\Adobe\CSXS.9" "PlayerDebugMode"
    DeleteRegValue HKCU "Software\Adobe\CSXS.10" "PlayerDebugMode"
    DeleteRegValue HKCU "Software\Adobe\CSXS.11" "PlayerDebugMode"
    DeleteRegValue HKCU "Software\Adobe\CSXS.12" "PlayerDebugMode"
  skip_debug:
  
  # Remove registry keys
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  
  DetailPrint "✅ Uninstallation completed successfully!"
  MessageBox MB_OK "${PRODUCT_NAME} has been successfully uninstalled from your computer."
SectionEnd

