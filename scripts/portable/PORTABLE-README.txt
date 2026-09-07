DNP AI Radar - portable copy
================================

New computer
------------
1. Install Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Start Docker Desktop and wait until it says the engine is running.
3. Keep Install-DNP-Ai-Radar.ps1 and payload.dnp together.
4. Double-click INSTALL-DNP-AI-RADAR.cmd.
5. Enter the transfer password chosen on the old computer.

The first installation downloads and builds the required containers, so it
needs an internet connection and can take several minutes. It restores all
accounts, brands, results, settings, API keys, and app secrets from the export.

Daily use
---------
Double-click START-DNP-AI-RADAR.cmd in the installed folder. Double-click
STOP-DNP-AI-RADAR.cmd when you want to stop it. Data remains saved in Docker.

Security
--------
payload.dnp is encrypted. Keep its password separate from the bundle. After
you confirm the new installation works, store the bundle somewhere secure or
delete it. Anyone with both the bundle and password can access the copied data
and credentials.
