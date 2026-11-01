# Message Ticker

A self-hosted, full-screen message ticker. Messages and playback settings are
stored in the browser, and ticker sounds are generated locally by the browser.
The app does not need a database, API service, or external audio files.

## Run with Docker

From the repository root:

```sh
docker build -f artifacts/message-ticker/Dockerfile -t message-ticker .
docker run -d --name message-ticker --restart unless-stopped -p 8080:80 message-ticker
```

Open `http://localhost:8080`. Change `8080` to the host port you want to use.

If you use Unraid, build the image from the repository root with the Dockerfile
at `artifacts/message-ticker/Dockerfile`, then map a host port to container port
`80`.

## Notes

- The browser's local storage keeps the message queue and preferences on that
  display device and browser.
- Most browsers require a user interaction before playing sound. Use the app's
  sound control or preview once after opening the page.
- To rebuild after changing the app, run the `docker build` command again and
  replace the existing container.
