import { raw } from '/rawjs/raw.esm.js';

function throttle(f, delay) {
  let timer = 0;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => f.apply(this, args), delay);
  };
}

const VideoRes = {
  Video_90P: 0,
  Video_180P: 1,
  Video_360P: 2,
  Video_720P: 3
};

export class VideoDisplay {
  aspectRatio = 16 / 9;
  minCellWidth = 256;
  minCellHeight = this.minCellWidth / this.aspectRatio;
  cellPadding = 5;
  maxPageSize = 25;
  page = 0;
  pageSize = 0;
  totalUserCount = 0;
  totalPages = 0;
  videoContainer = document.querySelector('video-player-container');

  constructor({ client, stream }) {
    this.videoSDK = client;
    this.stream = stream;
    this.stream.startVideo();
    this.videoContainer;
    // Setup Resize Observer
    this.resizeObserver = new ResizeObserver(throttle(this.renderVideos, 250));
    this.resizeObserver.observe(this.videoContainer, { box: 'content-box' });
  }

  containerDimensions = (el = this.videoContainer) => {
    let target = raw.get(el);
    let displayWidth = Math.floor(target().clientWidth);
    let displayHeight = Math.floor(target().clientHeight);
    return { displayWidth, displayHeight };
  };

  maxRowsColumns = () => {
    let { displayWidth, displayHeight } = this.containerDimensions();
    return {
      maxColumns: Math.max(1, Math.floor(displayWidth / (this.minCellWidth + this.cellPadding * 2))),
      maxRows: Math.max(1, Math.floor(displayHeight / (this.minCellHeight + this.cellPadding * 2)))
    };
  };

  maxViewportVideoCounts = () => {
    const { maxRows, maxColumns } = this.maxRowsColumns();
    return maxRows * maxColumns;
  };

  setUserList = async (user) => {
    this.usersList = await this.videoSDK.getAllUser(); // should I go ahead and sort by video on now, or later?
    // this.usersList = Array.from({ length: 25 });
    this.totalUserCount = this.usersList.length;
    this.totalPages = Math.ceil(this.totalUserCount / this.maxPageSize);
  };

  stopRenderVideo = async (user) => {
    let canvas = document.getElementsByTagName('video-player-container');
    try {
      await this.stream.stopRenderVideo(canvas, user.id);
    } catch {}
  };

  getResolution = () => {
    res = VideoRes.Video_90P;
    if (actualCount <= 4 && cellBoxHeight >= 510) {
      res = VideoRes.Video_720P;
    } else if (actualCount <= 4 && cellHeight >= 270) {
      res = VideoRes.Video_360P;
    } else if (actualCount > 4 && cellHeight >= 180) {
      res = VideoRes.Video_180P;
    }
    return res;
  };

  getBestSize = (numOfVideos) => {
    let { displayWidth, displayHeight } = this.containerDimensions();
    let { maxRows, maxColumns } = this.maxRowsColumns();
    let best = { width: 0, height: 0, cols: 0, rows: 0 };
    console.log(maxRows, maxRows);
    for (let cols = numOfVideos; cols > 0; cols--) {
      if (cols <= maxColumns) {
        const rows = Math.ceil(numOfVideos / cols);

        if (rows <= maxRows) {
          console.log(cols, rows);

          const hScale = displayWidth / (cols * this.aspectRatio);
          const vScale = displayHeight / rows;

          let width;
          let height;

          if (hScale <= vScale) {
            width = Math.floor(displayWidth / cols);
            height = Math.floor(width / this.aspectRatio);
          } else {
            height = Math.floor(displayHeight / rows);
            width = Math.floor(height * this.aspectRatio);
          }

          let area = width * height;
          if (area > best.width * best.height) {
            best = { width, height, cols, rows };
          }
        }
      }
    }
    return best;
  };

  renderVideos = async () => {
    let usersList = await this.videoSDK.getAllUser();
    let maxVideoCount = this.maxViewportVideoCounts();
    let videoCount = Math.min(usersList.length, maxVideoCount);
    let { width, height, rows, cols } = this.getBestSize(videoCount);
    console.log(width, height, cols, rows);
    this.videoContainer.style.setProperty('--videoWidth', width + 'px');
    this.videoContainer.style.setProperty('--videoHeight', height + 'px');
    let innerHTML = [];

    // if usersList.length > Math.min(maxVideoCount,25) - pagination

    await usersList.forEach(async (user, i) => {
      try {
        let userVideo = await this.stream.attachVideo(user.userId, VideoRes.Video_360P);
        innerHTML.push(userVideo.outerHTML);
      } catch (e) {}
    });
    this.videoContainer.innerHTML = innerHTML.join('');
  };
}

// video-player-container {
//   width: 100%;
//   height: 1000px;
// }

// video-player {
//   width: 100%;
//   height: auto;
//   aspect-ratio: 16/9;
// }

// let userVideo = await stream.attachVideo(USER_ID, RESOLUTION);

// document.querySelector('video-player-container').appendChild(userVideo);

// <video-player-container></video-player-container>
//    client.getAllUser().forEach((user) => {
//       if(user.bVideoOn) {
//         stream.attachVideo(user.userId, 3).then((userVideo) => {
//           document.querySelector('video-player-container').appendChild(userVideo);
//         })
//       }
//    })
