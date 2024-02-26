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

  layoutCandidates = Array.from({ length: this.maxPageSize })
    .map((_, index) => {
      const count = index + 1;
      const mid = Math.ceil(count / 2);
      const candidates = Array.from({ length: mid })
        .map((_, i) => {
          const row = i + 1;
          const column = Math.ceil(count / row);

          if (row < column) {
            return [
              { row, column },
              { row: column, column: row }
            ];
          }
          if (row === column) {
            return [{ row, column }];
          }
          return [];
        })
        .reduce((prev, curr) => [...prev, ...curr], []);
      return { count, candidates };
    })
    .reduce((prev, curr) => ({ ...prev, [curr.count]: curr.candidates }), {});

  preferredLayout = (layout) => {
    let { displayWidth, displayHeight } = this.containerDimensions();
    return layout
      .map((item) => {
        const { column, row } = item;
        const canonical = Math.floor(Math.min(displayWidth / (16 * column), displayHeight / (9 * row)));
        const cellWidth = canonical * 16 - this.cellPadding * 2;
        const cellHeight = canonical * 9 - this.cellPadding * 2;
        return {
          cellWidth,
          cellHeight,
          cellArea: cellWidth * cellHeight,
          column,
          row
        };
      })
      .reduce(
        (prev, curr) => {
          if (curr.cellArea > prev.cellArea) {
            return curr;
          }
          return prev;
        },
        { cellArea: 0, cellHeight: 0, cellWidth: 0, column: 0, row: 0 }
      );
  };

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

  optimizeLayout = (count) => {
    let { displayWidth, displayHeight } = this.containerDimensions();
    let { maxRows, maxColumns } = this.maxRowsColumns();

    if (count > this.maxPageSize || count === 0 || displayWidth === 0 || displayHeight === 0) {
      return []; // is this the right option?
    }

    maxRows = Math.min(maxRows, count);
    maxColumns = Math.min(maxColumns, count);
    const actualCount = Math.min(count, maxRows * maxColumns);

    const layout = this.layoutCandidates[actualCount].filter(
      (item) => item.row <= maxRows && item.column <= maxColumns
    );

    const { cellWidth, cellHeight, column, row } = this.preferredLayout(layout);

    const cellBoxWidth = cellWidth + this.cellPadding * 2;
    const cellBoxHeight = cellHeight + this.cellPadding * 2;
    const horizontalMargin = (displayWidth - cellBoxWidth * column) / 2 + this.cellPadding;
    const verticalMargin = (displayHeight - cellBoxHeight * row) / 2 + this.cellPadding;
    const cellDimensions = [];
    const lastRowColumns = column - ((column * row) % actualCount);
    const lastRowMargin = (displayWidth - cellBoxWidth * lastRowColumns) / 2 + this.cellPadding;
    let quality = 'Video_90P';

    if (actualCount <= 4 && cellBoxHeight >= 510) {
      quality = 'Video_720P';
    } else if (actualCount <= 4 && cellHeight >= 270) {
      quality = 'Video_360P';
    } else if (actualCount > 4 && cellHeight >= 180) {
      quality = 'Video_180P';
    }

    for (let i = 0; i < row; i++) {
      for (let j = 0; j < column; j++) {
        const leftMargin = i !== row - 1 ? horizontalMargin : lastRowMargin;
        if (i * column + j < actualCount) {
          cellDimensions.push({
            width: cellWidth,
            height: cellHeight,
            x: Math.floor(leftMargin + j * cellBoxWidth),
            y: Math.floor(verticalMargin + (row - i - 1) * cellBoxHeight),
            quality
          });
        }
      }
    }
    return cellDimensions;
  };

  resizeCanvas = async () => {
    let { displayWidth, displayHeight } = this.containerDimensions();
    let canvas = document.getElementById('video-render-canvas');
    try {
      this.stream.updateVideoCanvasDimension(canvas, displayWidth, displayHeight);
    } catch (error) {
      raw.get(canvas)({ width: displayWidth, height: displayHeight });
    }

    return { displayWidth, displayHeight };
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
    let best = { width: 0, height: 0 };
    for (let cols = numOfVideos; cols > 0; cols--) {
      const rows = Math.ceil(numOfVideos / cols);
      const hScale = displayWidth / (cols * this.aspectRatio);
      const vScale = displayHeight / rows;
      let width;
      let height;
      if (hScale <= vScale) {
        width = displayWidth / cols;
        height = width / this.aspectRatio;
      } else {
        height = displayHeight / rows;
        width = height * this.aspectRatio;
      }
      const area = width * height;
      if (area > best.width * best.height) {
        best = { width, height };
      }
    }
    return best;
  };

  renderVideos = async () => {
    let usersList = await this.videoSDK.getAllUser();
    let innerHTML = [];
    const { width, height } = this.getBestSize(usersList.length);
    await usersList.forEach(async (user, i) => {
      try {
        let userVideo = await this.stream.attachVideo(user.userId, VideoRes.Video_360P);

        userVideo = raw.get(userVideo)({
          height: height,
          width: width,
          flex: '1 0 auto',
          display: 'inline',
          'aspect-ratio': '16/9'
        });
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
