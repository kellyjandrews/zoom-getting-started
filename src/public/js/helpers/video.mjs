import { raw } from '/rawjs/raw.esm.js';

function throttle(f, delay) {
  let timer = 0;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => f.apply(this, args), delay);
  };
}

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

  constructor({ el, client, stream }) {
    // store the original parent element
    this.el = el;
    this.videoSDK = client;
    let { displayWidth, displayHeight } = this.containerDimensions();
    raw.get(this.el)(raw.canvas({ id: 'video-render-canvas', width: displayWidth, height: displayHeight }));
    this.stream = stream;
    this.stream.startVideo();
    // Setup Resize Observer
    this.resizeObserver = new ResizeObserver(throttle(this.renderVideos, 250));
    this.resizeObserver.observe(el, { box: 'content-box' });
  }

  containerDimensions = () => {
    let target = raw.get(this.el);
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
    // this.usersList = Array(50);
    this.totalUserCount = this.usersList.length;
    this.totalPages = Math.ceil(this.totalUserCount / this.maxPageSize);
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

  optimizeLayout = async (
    cellWidth = this.minCellWidth,
    cellHeight = this.minCellHeight,
    { maxRows, maxColumns } = this.maxRowsColumns()
  ) => {
    let { displayWidth, displayHeight } = await this.resizeCanvas();
    this.pageSize = Math.min(this.maxPageSize, maxRows * maxColumns);
    let userCount = this.pageSize;

    if (this.page === this.totalPages - 1) {
      userCount = Math.min(userCount, this.totalUserCount % this.pageSize || userCount);
    }

    maxRows = Math.min(maxRows, userCount);
    maxColumns = Math.min(maxColumns, userCount);

    const actualCount = Math.min(userCount, maxRows * maxColumns);
    cellWidth = Math.floor(displayWidth / maxColumns);
    cellHeight = Math.floor(cellWidth * 0.5625);

    if (cellHeight * maxRows > displayHeight) {
      cellHeight = Math.floor(displayHeight / maxRows);
      cellWidth = Math.floor(cellHeight * this.aspectRatio);
    }

    const horizontalMargin = (displayWidth - cellWidth * maxColumns) / 2;
    const verticalMargin = (displayHeight - cellHeight * maxRows) / 2;

    return {
      cellHeight,
      cellWidth,
      maxColumns,
      maxRows,
      horizontalMargin,
      verticalMargin,
      displayWidth,
      displayHeight
    };
  };

  stopRenderVideo = async (user) => {
    let canvas = document.getElementById('video-render-canvas');
    try {
      await this.stream.stopRenderVideo(canvas, user.id);
    } catch {}
  };

  renderVideos = async () => {
    console.log('rendering videos');
    let canvas = document.getElementById('video-render-canvas');
    await this.setUserList();
    console.log(this.usersList);
    let { cellHeight, cellWidth, verticalMargin, horizontalMargin, displayHeight, displayWidth, maxColumns, maxRows } =
      await this.optimizeLayout();

    // sort and filter the users into self render > user videos > user avatars

    let row = 1;
    let col = 0;

    for (const user of this.usersList) {
      if (col >= maxColumns) {
        row++;
        col = 0;
      }

      try {
        await this.stream.stopRenderVideo(canvas, user.userId);
        await this.stream.renderVideo(
          canvas,
          user.userId,
          cellWidth,
          cellHeight,
          cellWidth * col + horizontalMargin,
          displayHeight - cellHeight * row - verticalMargin,
          2
        );
      } catch (e) {
        // console.log(e);
        // render avatar or something
      }

      col++;
    }

    return;
  };
}

// [
//   {
//     userId: 117441536,
//     avatar: '',
//     displayName: 'kja',
//     isHost: false,
//     audio: '',
//     bVideoOn: false,
//     userGuid: '2FF1AA68-C43E-F6D5-1355-925AA47049FB',
//     isPhoneUser: false,
//     isManager: false,
//     isAllowIndividualRecording: false,
//     isVideoConnect: true
//   }
// ];

// const preferredLayout: Layout = layoutOfCount
//     .map((item) => {
//       const { column, row } = item;
//       const canonical = Math.floor(Math.min(rootWidth / (16 * column), rootHeight / (9 * row)));
//       const cellWidth = canonical * 16 - cellOffset * 2;
//       const cellHeight = canonical * 9 - cellOffset * 2;
//       return {
//         cellWidth,
//         cellHeight,
//         cellArea: cellWidth * cellHeight,
//         column,
//         row
//       };
//     })
//     .reduce(
//       (prev, curr) => {
//         if (curr.cellArea > prev.cellArea) {
//           return curr;
//         }
//         return prev;
//       },
//       { cellArea: 0, cellHeight: 0, cellWidth: 0, column: 0, row: 0 }
//     );
//   const { cellWidth, cellHeight, column, row } = preferredLayout;

//   const cellBoxWidth = cellWidth + cellOffset * 2;
//   const cellBoxHeight = cellHeight + cellOffset * 2;
//   const horizontalMargin = (rootWidth - cellBoxWidth * column) / 2 + cellOffset;
//   const verticalMargin = (rootHeight - cellBoxHeight * row) / 2 + cellOffset;
//   const cellDimensions = [];
//   const lastRowColumns = column - ((column * row) % actualCount);
//   const lastRowMargin = (rootWidth - cellBoxWidth * lastRowColumns) / 2 + cellOffset;
//   let quality = VideoQuality.Video_90P;

//   if (actualCount <= 4 && cellBoxHeight >= 510) {
//     // GROUP HD
//     quality = VideoQuality.Video_720P;
//   } else if (actualCount <= 4 && cellHeight >= 270) {
//     quality = VideoQuality.Video_360P;
//   } else if (actualCount > 4 && cellHeight >= 180) {
//     quality = VideoQuality.Video_180P;
//   }
//   for (let i = 0; i < row; i++) {
//     for (let j = 0; j < column; j++) {
//       const leftMargin = i !== row - 1 ? horizontalMargin : lastRowMargin;
//       if (i * column + j < actualCount) {
//         cellDimensions.push({
//           width: cellWidth,
//           height: cellHeight,
//           x: Math.floor(leftMargin + j * cellBoxWidth),
//           y: Math.floor(verticalMargin + (row - i - 1) * cellBoxHeight),
//           quality
//         });
//       }
//     }
//   }
//   return cellDimensions;
// }

// const layoutOfCount = layoutCandidates[actualCount].filter((item) => item.row <= maxRows && item.column <= maxColumns);
// const layoutCandidates = { length: 9 }
//   .map((value, index) => {
//     const count = index + 1;
//     const mid = Math.ceil(count / 2);
//     const candidates = Array.from({ length: mid })
//       .map((v, i) => {
//         const row = i + 1;
//         const column = Math.ceil(count / row);
//         if (row < column) {
//           return [
//             {
//               row,
//               column
//             },
//             {
//               row: column,
//               column: row
//             }
//           ];
//         }
//         if (row === column) {
//           return [
//             {
//               row,
//               column
//             }
//           ];
//         }
//         return [];
//       })
//       .reduce((prev, curr) => [...prev, ...curr], []);
//     return { count, candidates };
//   })
//   .reduce((prev, curr) => ({ ...prev, [curr.count]: curr.candidates }), {});

// export function getVideoLayout(rootWidth: number, rootHeight: number, count: number): CellLayout[] {
//   /**
//    * [1,count]
//    */
//   if (count > maxCount || count === 0 || rootWidth === 0 || rootHeight === 0) {
//     return [];
//   }
//   let { maxRows, maxColumns } = maxRowsColumns(rootWidth, rootHeight);
//   maxRows = Math.min(maxRows, count);
//   maxColumns = Math.min(maxColumns, count);
//   const actualCount = Math.min(count, maxRows * maxColumns);
//   const layoutOfCount = layoutCandidates[actualCount].filter(
//     (item) => item.row <= maxRows && item.column <= maxColumns
//   );
//   const preferredLayout: Layout = layoutOfCount
//     .map((item) => {
//       const { column, row } = item;
//       const canonical = Math.floor(Math.min(rootWidth / (16 * column), rootHeight / (9 * row)));
//       const cellWidth = canonical * 16 - cellOffset * 2;
//       const cellHeight = canonical * 9 - cellOffset * 2;
//       return {
//         cellWidth,
//         cellHeight,
//         cellArea: cellWidth * cellHeight,
//         column,
//         row
//       };
//     })
//     .reduce(
//       (prev, curr) => {
//         if (curr.cellArea > prev.cellArea) {
//           return curr;
//         }
//         return prev;
//       },
//       { cellArea: 0, cellHeight: 0, cellWidth: 0, column: 0, row: 0 }
//     );
//   const { cellWidth, cellHeight, column, row } = preferredLayout;
//   const cellBoxWidth = cellWidth + cellOffset * 2;
//   const cellBoxHeight = cellHeight + cellOffset * 2;
//   const horizontalMargin = (rootWidth - cellBoxWidth * column) / 2 + cellOffset;
//   const verticalMargin = (rootHeight - cellBoxHeight * row) / 2 + cellOffset;
//   const cellDimensions = [];
//   const lastRowColumns = column - ((column * row) % actualCount);
//   const lastRowMargin = (rootWidth - cellBoxWidth * lastRowColumns) / 2 + cellOffset;
//   let quality = VideoQuality.Video_90P;

//   if (actualCount <= 4 && cellBoxHeight >= 510) {
//     // GROUP HD
//     quality = VideoQuality.Video_720P;
//   } else if (actualCount <= 4 && cellHeight >= 270) {
//     quality = VideoQuality.Video_360P;
//   } else if (actualCount > 4 && cellHeight >= 180) {
//     quality = VideoQuality.Video_180P;
//   }
//   for (let i = 0; i < row; i++) {
//     for (let j = 0; j < column; j++) {
//       const leftMargin = i !== row - 1 ? horizontalMargin : lastRowMargin;
//       if (i * column + j < actualCount) {
//         cellDimensions.push({
//           width: cellWidth,
//           height: cellHeight,
//           x: Math.floor(leftMargin + j * cellBoxWidth),
//           y: Math.floor(verticalMargin + (row - i - 1) * cellBoxHeight),
//           quality
//         });
//       }
//     }
//   }
//   return cellDimensions;
// }

// if (stream.isRenderSelfViewWithVideoElement()) {
//   await stream.startVideo({ videoElement: document.querySelector('#my-self-view-video') });
//   // video successfully started and rendered
// } else {
//   await stream.startVideo();
//   await stream.renderVideo(
//     document.querySelector('#my-self-view-canvas'),
//     client.getCurrentUserInfo().userId,
//     1920,
//     1080,
//     0,
//     0,
//     3
//   );
//   // video successfully started and rendered
// }
