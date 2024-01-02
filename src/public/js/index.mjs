import ZoomVideo from '/zoom/videosdk/dist/index.esm.js';

const client = ZoomVideo.createClient();
let canvas = document.querySelector('#videos');
let mediaStream;
let displayWidth;
let displayHeight;
let videoWidth;
let videoHeight;

async function onResize() {
  await renderVideo();
}

function resizeCanvasToDisplaySize() {
  let width = canvas.clientWidth;
  let height = canvas.clientHeight;
  displayHeight = Math.floor(height);
  displayWidth = Math.floor(width);

  let needResize = canvas.width != displayWidth || canvas.height != displayHeight;

  if (needResize) {
    try {
      mediaStream.updateVideoCanvasDimension(canvas, displayWidth, displayHeight);
    } catch (error) {
      canvas.height = displayHeight;
      canvas.width = (displayHeight * 16) / 9;
    }
  }
}

function throttle(f, delay) {
  let timer = 0;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => f.apply(this, args), delay);
  };
}

const resizeObserver = new ResizeObserver(throttle(renderVideo, 250));
resizeObserver.observe(canvas, { box: 'content-box' });

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

async function drawGridView() {
  let rowN = 1;
  let colN = 0;
  videoWidth = Math.floor(displayWidth / 5);
  videoHeight = Math.floor((videoWidth * 9) / 16);

  const userList = client.getAllUser().reverse();
  console.log(canvas.height, canvas.clientHeight, displayHeight);
  console.log(canvas);
  for (const [index, user] of userList.entries()) {
    if (user.bVideoOn) {
      if (colN === 5) {
        rowN++;
        colN = 0;
      }
      let videoX = videoWidth * colN;
      let videoY = Math.floor(displayHeight - videoHeight * rowN);
      try {
        await mediaStream.adjustRenderedVideoPosition(canvas, user.userId, videoWidth, videoHeight, videoX, videoY, 2);
      } catch (error) {
        await mediaStream.renderVideo(canvas, user.userId, videoWidth, videoHeight, videoX, videoY, 2);
      }
      colN++;
    }
  }
}

function renderVideo() {
  resizeCanvasToDisplaySize();
  drawGridView();
}

async function initVideoSDK() {
  let { signature } = await getVideoSDKJWT();
  await client.init('en-US', 'Global', { patchJsMedia: true });
  client.on('peer-video-state-change', renderVideo);
  await client.join('kja-test', signature, 'kja');
  client.on('user-added', renderVideo);
  client.on('user-updated', renderVideo);
  client.on('user-removed', renderVideo);
  mediaStream = client.getMediaStream();
  await mediaStream.startVideo();
  renderVideo();
}

initVideoSDK();
