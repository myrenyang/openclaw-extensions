---
name: gateway-startup-notify
description: "Send notification to Telegram when Gateway starts"
metadata:
  openclaw:
    events:
      - gateway:startup
    install:
      - id: custom
        kind: custom
        label: Custom Hook
---

# gateway-startup-notify

Send notification to Telegram when Gateway starts.
