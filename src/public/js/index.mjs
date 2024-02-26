import ZoomVideo from '/zoom/index.esm.js';
import { VideoDisplay } from './helpers/video.mjs';
const client = ZoomVideo.createClient();
async function getVideoSDKJWT() {
  let response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      topic: 'kja-test',
      roleType: 0,
      name: 'kja'
    })
  });

  return await response.json();
}

async function initVideoSDK() {
  let { signature } = await getVideoSDKJWT();
  await client.init('en-US', 'Global', { patchJsMedia: true, leaveOnPageUnload: true });
  await client.join('kja-test', signature, 'kja');
  let stream = await client.getMediaStream();
  let videoDisplay = new VideoDisplay({ client, stream });

  client.on('user-added', (payload) => {
    console.log('user-added', payload);
    // videoDisplay.renderVideos();
  });

  client.on('peer-video-state-change', (payload) => {
    console.log('peer-video-state-change', payload);
    switch (payload.action) {
      case 'Start':
        videoDisplay.renderVideos();
        break;
      default:
        break;
    }
  });
  client.on('user-updated', (payload) => {
    console.log('user-updated', payload);
  });
  client.on('user-removed', videoDisplay.stopRenderVideo);
  client.on('connection-change', (payload) => {
    console.log('connection-change', payload);
  });
  client.on('video-capturing-change', (payload) => {
    console.log('video-capturing-change', payload);
    switch (payload.state) {
      case 'Started':
        videoDisplay.renderVideos();
        break;
      default:
        break;
    }
  });
}

await initVideoSDK();
