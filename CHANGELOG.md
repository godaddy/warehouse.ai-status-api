# CHANGELOG

- Add env based configuration for database region
- Fix bug in status-handler

### 2.1.5

- Don't let invalid message type break status-handler

### 2.1.4

- Update warehouse.ai-status-models with updated dynastar
- Fix raciness with status/statushead findOne (in theory)

### 2.1.3

- update nsq.js-k8 to support node@12

### 2.1.2

- Fix webhooks data

### 2.1.1

- Add repo information to web hooks

### 2.1.0

- Add build_completed webhook type
- Fix Travis CI

### 2.0.2

- `request-promise-native` should be a regular dep

### 2.0.1

- Use `database` as property for config, similar to other warehouse services.

### 2.0.0

- BREAKING--Convert datastar models to dynastar models
- Add build_started webhook type
- Add webhooks support

### 1.1.3

- Fix spelling error in swagger docs

### 1.1.2

- Update swagger docs to dereference for better AWS Support
- [#11] Update `README.md` content
  - Update patch/minor version of dependencies.
- [#10] Default documentation
  - Add: `CONTRIBUTING.md`, `CHANGELOG.md`, `SECURITY.md`
  - update `LICENSE` year
  - add `.github` templates
  - Give credits for Github templates

[#10]: https://github.com/godaddy/warehouse.ai-status-api/pull/10
[#11]: https://github.com/godaddy/warehouse.ai-status-api/pull/11
