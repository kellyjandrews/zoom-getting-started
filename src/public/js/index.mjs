import ZoomVideo from '/zoom/videosdk/dist/index.esm.js';

// method to handle pagination and user list
// filters for toggle self view, toggle non-video
// method to render the video (takes a list of users, grid size)
// method to handle all of this

// Rule set
// Max # of Users to display / Column Width / ().5625 * Column Width)
// Minimum Video Width/Height Set
// Grid Priority - Screen Size > Number of Participants
// Grid_1: 2 / 100% * canvas*width
// Grid_2: 4 / 50% * canvas*width
// Grid_3: 9 / 33% * canvas*width
// Grid_4: 16 / 25% * canvas*width
// Grid_5: 25 / 20% * canvas*width

// [x, y] = [canvas.height - rowHeight * row];

// render_video - users to render, grid
// video-detailed-data-change
const client = ZoomVideo.createClient();
let canvas = document.querySelector('#videos');
let mediaStream;
let displayHeight;
let displayWidth;
let userDisplayMap = new Map();

function resizeCanvasToDisplaySize() {
  displayWidth = Math.floor(canvas.clientWidth);
  displayHeight = Math.floor(displayWidth * 0.5625);
  let needResize = canvas.width != displayWidth || canvas.height != displayHeight;
  if (needResize) {
    try {
      mediaStream.updateVideoCanvasDimension(canvas, displayWidth, displayHeight);
    } catch (error) {
      console.log(error);
      canvas.width = displayWidth;
      canvas.height = displayHeight;
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

// what determines the grid size?
// what controls the UserList?
//
async function drawGridView(userList) {
  let row = 1;
  let col = 0;
  let videoWidth = Math.floor(displayWidth / gridSize);
  let videoHeight = Math.floor(videoWidth * 0.5625);

  for (const [index, user] of userList.entries()) {
    if (col === gridSize) {
      //do I need to stop/error at max capacity?
      row++;
      col = 0;
    }
    // if row is not full, center with with half the remaining difference
    let videoX = Math.floor(videoWidth * col);
    let videoY = Math.floor(displayHeight - videoHeight * row);
    await mediaStream?.stopRenderVideo(canvas, user.userId);
    await mediaStream?.renderVideo(canvas, user.userId, videoWidth, videoHeight, videoX, videoY, 2);
    col++;
  }
}

function renderVideo(payload) {
  // this should manage the pagination, etc.
  const userList = client.getAllUser().reverse();
  console.log(userList);
  console.log(payload);
  resizeCanvasToDisplaySize();
  // filter by non-video
  // turn off self view

  // max grid size
  // minimum video width?
  // pagination - handling the number of pages etc

  drawGridView(user, gridSize);
}

async function initVideoSDK() {
  let { signature } = await getVideoSDKJWT();
  await client.init('en-US', 'Global', { patchJsMedia: true });
  client.on('peer-video-state-change', renderVideo);
  await client.join('kja-test', signature, 'kja');
  client.on('user-added', renderVideo);
  client.on('user-updated', renderVideo);
  client.on('user-removed', renderVideo);
  client.on('video-dimension-change', renderVideo);
  client.on('video-statistic-data-change', renderVideo);

  mediaStream = client.getMediaStream();
  mediaStream.startVideo();
  renderVideo();
}

await initVideoSDK();
