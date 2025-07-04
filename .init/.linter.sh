#!/bin/bash
cd /home/kavia/workspace/code-generation/sketchspin-multiplayer-106200-f2ee74ec/react_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

