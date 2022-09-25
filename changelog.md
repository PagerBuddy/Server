# Version 1.1.3 (2022-09-24)

## Added

## Changed

## Fixed 
* Database structure not allowing for unknown ZVEIs in history
* Service had insufficient priviliges for SQLite
* Logging bug
* Excessive reporting on empty alerts from KatSys

## Removed

# Version 1.1.2 (2022-09-10)

## Added
* Configuration option for special reply option "direct"

## Changed

## Fixed 
* JSDoc generation bugs

## Removed

# Version 1.1.1 (2022-09-08)

## Added

## Changed

## Fixed 
* JSDoc generation of .mjs files

## Removed

# Version 1.1.0 (2022-09-08)

## Added
* Data model using JavaScript classes:
  - Groups
  - Users
  - ZVEIs
* Separate testing database

## Changed
* Re-organize code (especially for KatSys) to be easier to read
* Groups' `auth_token`s must now be unique in the database
## Fixed 
* Issues with systemd when installing PagerBuddy Server on Linux systems

## Removed

# Version 1.0 (2022-08-13)

Initial release
