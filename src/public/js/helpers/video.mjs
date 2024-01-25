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

  optimizeLayout = (count) => {
    let { displayWidth, displayHeight } = this.containerDimensions();
    let { maxRows, maxColumns } = this.maxRowsColumns();

    if (count > this.maxPageSize || count === 0 || displayWidth === 0 || displayHeight === 0) {
      return [];
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
    let canvas = document.getElementById('video-render-canvas');
    try {
      await this.stream.stopRenderVideo(canvas, user.id);
    } catch {}
  };

  renderVideos = async () => {
    let canvas = document.getElementById('video-render-canvas');
    await this.resizeCanvas();
    await this.setUserList();
    let userCount = this.usersList.length;
    // somewhere in here is paging...
    let optimizedLayout = this.optimizeLayout(userCount);
    this.usersList.forEach(async (user, i) => {
      let { width, height, x, y, quality } = optimizedLayout[i];
      console.log(optimizedLayout[i]);
      try {
        await this.stream.stopRenderVideo(canvas, user.userId);
        await this.stream.renderVideo(canvas, user.userId, width, height, x, y, quality);
      } catch (e) {
        // console.log(e);
        // render avatar or something
      }
    });
  };
}
