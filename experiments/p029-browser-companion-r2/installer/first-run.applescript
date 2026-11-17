on run
 set appRoot to POSIX path of (path to me)
 set runner to appRoot & "Contents/Resources/install-browser-companion.sh"
 try
  set rawAccounts to do shell script (quoted form of runner) & " --list"
 on error errText
  display alert "LUCH Companion" message "Не удалось проверить устройства. " & errText as warning
  return
 end try
 if rawAccounts is "" then
  set response to display dialog "На этом Mac пока не найден подключённый LUCH Companion. Сначала подключите Mac к своей учётной записи LUCH." buttons {"Закрыть", "Открыть инструкцию"} default button "Открыть инструкцию"
  if button returned of response is "Открыть инструкцию" then open location "https://luch.lenarsalimov.ru/ru/connect/"
  return
 end if
 set rawLines to paragraphs of rawAccounts
 set choices to {}
 repeat with entry in rawLines
  set AppleScript's text item delimiters to tab
  set parts to text items of (contents of entry)
  set AppleScript's text item delimiters to ""
  if (count of parts) ≥ 2 then set end of choices to ((item 2 of parts) & " · " & (item 1 of parts))
 end repeat
 set selected to choose from list choices with title "Подключение LUCH" with prompt "Выберите уже авторизованный Companion. Доступ к вашим вкладкам вы разрешите отдельно." OK button name "Продолжить" cancel button name "Отмена" without multiple selections allowed
 if selected is false then return
 set ix to 0
 repeat with j from 1 to count of choices
  if item j of choices is item 1 of selected then
   set ix to j
   exit repeat
  end if
 end repeat
 if ix is 0 then return
 set AppleScript's text item delimiters to tab
 set fields to text items of (item ix of rawLines)
 set AppleScript's text item delimiters to ""
 set identity to item 1 of fields
 set installCommand to (quoted form of runner) & " --install --device-id " & (quoted form of identity)
 try
  set resultText to do shell script installCommand
 on error errText
  if errText contains "EXISTING_BROKER_REQUIRES_MANAGED_MIGRATION" then
   set answer to display dialog "Найден старый Browser Companion. Можно заменить только известную версию и только без активных подключений. Заменить?" buttons {"Отмена", "Заменить"} default button "Отмена" with icon caution
   if button returned of answer is not "Заменить" then return
   try
    set resultText to do shell script installCommand & " --migrate-known-legacy"
   on error installError
    display alert "LUCH не установлен" message installError as warning
    return
   end try
  else
   display alert "LUCH не установлен" message errText as warning
   return
  end if
 end try
 set done to display dialog "LUCH Browser Companion подключён к выбранному Companion. Откройте расширение Chrome, введите код и разрешите нужную вкладку." buttons {"Готово", "Открыть подключение"} default button "Открыть подключение"
 if button returned of done is "Открыть подключение" then open location "http://127.0.0.1:9248/setup"
end run
