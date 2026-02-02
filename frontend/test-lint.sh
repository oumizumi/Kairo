#!/bin/bash
cd "$(dirname "$0")"
echo "Testing lint command..."
npm run lint
echo "Exit code: $?"
