import _ from 'lodash-es';
import { useEmitt } from '@sutpc/portal/src/hooks';
import { SPHERE_RADIUS } from './constants';
import TagDot from './tagDot.js';
import utils from './utils.js';
import { base64ToStr } from '@/utils/base64';
const { emitter } = useEmitt();

export default class LineEditPainter {
  constructor(viewer) {
    this.viewer = viewer;
    // 用于控制是否layer可操纵
    this.active = false;
    // 标识当前编辑状态为空
    this.editing = '';
    this.uniqueId = 1;
    this.lines = [];
    this.mouse = {
      mouseDownX: 0,
      mouseDownY: 0,
      initX: 0,
      initY: 0
    };
    this.tempMesh = new THREE.Mesh();
    this.handleDrawPointClick = this.handleDrawPointClick.bind(this);
    this.handleDrawPointMove = this.handleDrawPointMove.bind(this);
    this.handleDotMouseDown = this.handleDotMouseDown.bind(this);
    this.handleDotMouseMove = this.handleDotMouseMove.bind(this);
    this.handleDotMouseUp = this.handleDotMouseUp.bind(this);
  }

  setActive(active) {
    this.active = active;
  }

  setLines(lines) {
    this.viewer.renderWithThreejs.clear();
    // TODO: CLEAR LINES
    this.lines.forEach((line) => {
      line.points?.forEach((dot) => {
        dot.dispose();
      });
    });

    // TODO: RECREATE LINES
    this.lines = [];
    lines?.forEach((line) => {
      const newLine = {
        ...line,
        uid: _.uniqueId('line_'),
        points: [] // 点集合
      };
      line.points?.forEach((data, index) => {
        const dom = this.createDom(data, newLine.uid);
        if (index === 0 && line.enableTooltip) {
          // 如果是第一个点就添加弹窗
          const tooltip = document.createElement('div');
          tooltip.className = `tag-dot__tooltip tooltip-${line.contentSizeType} shengchuang`;
          tooltip.innerHTML = line.content ? base64ToStr(line.content) : '';
          dom.appendChild(tooltip);
        }
        const dot = new TagDot(dom, data);
        this.viewer.renderDot(dot);
        newLine.points.push(dot);
      });
      this.lines.push(newLine);
    });
  }

  dispose() {
    this.lines?.forEach((line) => {
      line.points?.forEach((p) => p.dispose());
    });
    this.lines = [];
    this.tempMesh?.remove();
    if (this.newLine) {
      this.newLine.points.forEach((p) => {
        p.dispose();
      });
      this.newLine = null;
    }
  }

  render() {
    // if (!this.lines?.length) return
    // 渲染line列表
    this.lines?.forEach((line) => {
      // // 若为正在绘制的线,后续再渲染,先跳过
      // if (line.uid === this.newLine?.uid) return
      // this.renderLine(line);
      this.viewer.renderWithThreejs.renderLine(line);
      this.renderText(line);
    });
    // 渲染正在绘制的line
    if (this.newLine) {
      // this.renderLine(this.newLine);
      this.viewer.renderWithThreejs.renderLine(this.newLine);
      this.renderText(this.newLine);

      // this.renderDrawingLine()
    }
  }

  // 绘制到当前鼠标停留的地方
  renderDrawingLine() {
    if (!this.newLine) return;
    if (!this.newLine.points.length) return;
    if (!this.drawMoveArg) return;

    const drawMoveArg = this.drawMoveArg;
    const p = this.newLine.points[this.newLine.points.length - 1];
    const isOffScreen = utils.isOffScreen(p.tagMesh, this.viewer.camera);

    const canvas = this.viewer.topCanvas;
    const ctx = canvas.getContext('2d');

    let position;
    if (isOffScreen) {
      const moveAngles = this.viewer.pixelToAngle(drawMoveArg.x, drawMoveArg.y);
      const angle = this.getInterpolateAngle(moveAngles, p.dirAngle);
      this.setMeshAngle(angle);
      position = this.toScreenPosition(this.tempMesh);
    } else {
      position = this.toScreenPosition(p.tagMesh);
    }

    ctx.strokeStyle = '#3877F8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(position.x, position.y);
    ctx.lineTo(drawMoveArg.x, drawMoveArg.y);
    ctx.stroke();

    // ctx.beginPath()
    // ctx.moveTo(position.x, position.y)
    // ctx.arc(position.x, position.y, 5, 0, 2 * Math.PI)
    // ctx.stroke()

    // ctx.beginPath()
    // ctx.moveTo(drawMoveArg.x, drawMoveArg.y)
    // ctx.arc(drawMoveArg.x, drawMoveArg.y, 5, 0, 2 * Math.PI)
    // ctx.stroke()
  }

  renderLine(line) {
    for (let i = 0; i < line.points.length - 1; i++) {
      const p1 = line.points[i];
      const p2 = line.points[i + 1];
      // 判断2个点是否在屏幕外
      const isOffScreen1 = utils.isOffScreen(p1.tagMesh, this.viewer.camera);
      const isOffScreen2 = utils.isOffScreen(p2.tagMesh, this.viewer.camera);
      if (isOffScreen1 && isOffScreen2) {
        // 均不可见, 不画线
        continue;
      } else if (!isOffScreen1 && !isOffScreen2) {
        // 都可见,直接二者相连
        this.renderFullLine(p1.tagMesh, p2.tagMesh, line);
      } else if (isOffScreen1 && !isOffScreen2) {
        // A不可见 B可见, 从B连到A/B最近的可见插值点
        this.renderPartialLine(p2, p1, line);
      } else if (!isOffScreen1 && isOffScreen2) {
        // A可见 B不可见, 从A连到A/B最近的可见插值点
        this.renderPartialLine(p1, p2, line);
      }
    }
    this.renderText(line);
  }

  renderText(line) {
    if (!line.showContent) return;
    // 找到最后一个屏幕内的点
    const point = _.findLast(line.points, (p) => !utils.isOffScreen(p.tagMesh, this.viewer.camera));
    if (point) {
      const canvas = this.viewer.topCanvas;
      const ctx = canvas.getContext('2d');
      const position = this.toScreenPosition(point.tagMesh);
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#ffffff';
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgb(0 0 0 / 50%)';
      ctx.fillText(line.title, position.x, position.y + 30);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    }
  }

  renderFullLine(mesh1, mesh2, line) {
    const canvas = this.viewer.topCanvas;
    const ctx = canvas.getContext('2d');

    const position1 = this.toScreenPosition(mesh1);
    const position2 = this.toScreenPosition(mesh2);

    ctx.strokeStyle = line.lineColor || '#fff';
    ctx.lineWidth = line.lineWidth || 4;
    const width = ctx.lineWidth < 2 ? 2 : ctx.lineWidth;
    switch (line.lineType) {
      case 'dashed':
        ctx.setLineDash([10, width]);
        break;
      case 'dot-line':
        ctx.setLineDash([15, width, width, width]);
        break;
      case 'dots':
        ctx.setLineDash([width, width]);
        break;
      default:
        ctx.setLineDash([]);
        break;
    }

    ctx.beginPath();
    ctx.moveTo(position1.x, position1.y);
    ctx.lineTo(position2.x, position2.y);
    ctx.stroke();

    // ctx.beginPath()
    // ctx.moveTo(position1.x, position1.y)
    // ctx.arc(position1.x, position1.y, 5, 0, 2 * Math.PI)
    // ctx.stroke()

    // ctx.beginPath()
    // ctx.moveTo(position2.x, position2.y)
    // ctx.arc(position2.x, position2.y, 5, 0, 2 * Math.PI)
    // ctx.stroke()
  }

  /**
   * 绘制一端在屏幕外的情况
   * p1: 可见点
   * p2: 不可见点
   */
  renderPartialLine(p1, p2, line) {
    // 获取插值后的最新点
    const angle = this.getInterpolateAngle(p1.dirAngle, p2.dirAngle);
    this.setMeshAngle(angle);
    this.renderFullLine(p1.tagMesh, this.tempMesh, line);
  }

  /**
   * 二分法对经纬度数据进行插值
   * @param {*} angle1  屏幕内的点
   * @param {*} angle2  屏幕外的点
   * @param {*} loops 循环次数
   */
  getInterpolateAngle(angle1, angle2, loops = 10) {
    if (!loops) return angle1;
    const angle = {
      x: this.getMiddlePoint(angle1.x, angle2.x),
      y: (angle1.y + angle2.y) / 2
    };
    this.setMeshAngle(angle);
    const isOffScreen = utils.isOffScreen(this.tempMesh, this.viewer.camera);
    if (!isOffScreen) {
      return this.getInterpolateAngle(angle, angle2, loops - 1);
    } else {
      return this.getInterpolateAngle(angle1, angle, loops - 1);
    }
  }

  setMeshAngle(angle) {
    const position = utils.lglt2xyz(angle.x, -angle.y + Math.PI / 2, SPHERE_RADIUS);
    this.tempMesh.position.copy(position);
    this.tempMesh.updateMatrixWorld();
  }

  /**
   *
   * 由于经度的特殊性,这里对经度X方向的计算上采用就近原则,
   * 例如 175和-172两个点可以理解为距离很近的2个点相连, 而不是跨过300多度角将二者相连
   * @param {*} x1
   * @param {*} x2
   */
  getMiddlePoint(x1, x2) {
    // return (x1 + x2) / 2
    const a1 = x1 > x2 ? x1 : x2;
    const a2 = x1 > x2 ? x2 : x1;
    if (a1 - a2 > Math.PI) {
      const a = (a1 + Math.PI * 2 + a2) / 2;
      return a > Math.PI ? a - Math.PI * 2 : a;
    } else {
      return (x1 + x2) / 2;
    }
  }

  toScreenPosition(mesh) {
    const position = utils.toScreenPosition(mesh, this.viewer.camera, this.viewer.container);
    return { x: position[0], y: position[1] };
  }

  getTitle() {
    const title = `线标记${this.uniqueId}`;
    this.uniqueId++;
    const finded = this.lines.find((x) => x.title === title);
    return finded ? this.getTitle() : title;
  }
  // 添加线: 启动添加
  startAddLine() {
    // 开启描点
    this.editing = 'add';
    this.viewer.mouseControl.setActive(false);
    this.viewer.canvas.style.cursor = 'url(/assets/vr/line_dot.ico) 10 9,default';
    // 构造存储结构用于接下来填充
    this.newLine = {
      uid: _.uniqueId('line_'),
      title: this.getTitle(),
      showContent: false,
      type: 'shape',
      lineColor: '#ffffff',
      lineType: 'solid',
      lineWidth: 4,
      lineColorHover: '#ffffff',
      lineTypeHover: 'solid',
      lineWidthHover: 4,
      points: [] // 点集合
    };

    this.viewer.canvas.addEventListener('mousedown', this.handleDrawPointClick);
    // this.viewer.canvas.addEventListener('mousemove', this.handleDrawPointMove)
  }

  // 编辑线: 启动编辑
  startEditLine(lineid) {
    this.editing = 'edit';
    const index = this.lines.findIndex((x) => x.uid === lineid);
    if (index < 0) return;
    this.newLine = this.lines.splice(index, 1)[0];
    // 用于缓存
    this.editBuff = {
      ...this.newLine,
      points: this.newLine.points.map((x) => ({ ...x.data }))
    };
    this.viewer.mouseControl.setActive(false);
    this.viewer.canvas.style.cursor = 'url(/assets/vr/line_dot.ico) 10 9,default';
    this.viewer.canvas.addEventListener('mousedown', this.handleDrawPointClick);
  }

  // 添加线: 结束添加
  finishLine() {
    if (this.newLine && this.newLine.points.length > 1) {
      // 提交有效绘制
      this.lines.push(this.newLine);
      const data = {
        ...this.newLine,
        points: this.newLine.points.map((x) => x.data)
      };
      if (this.editing === 'add') {
        emitter.emit('CREATE_LINE_TAG_DATA', data);
      } else if (this.editing === 'edit') {
        emitter.emit('UPDATE_LINE_TAG_DATA', data);
      }
      // 缓存设为空, 后续cancle过程不会dispose相关资源
      this.newLine = null;
    }
    this.endLine();
  }

  // 结束绘制,恢复现场
  endLine() {
    if (this.drawMoveArg) {
      this.drawMoveArg = null;
    }

    // 恢复现场
    this.editing = '';
    this.editBuff = null;
    this.viewer.mouseControl.setActive(true);
    this.viewer.canvas.style.cursor = 'default';
    this.viewer.canvas.removeEventListener('mousedown', this.handleDrawPointClick);
    // this.viewer.canvas.removeEventListener('mousemove', this.handleDrawPointMove)

    emitter.emit('ON_LINE_SELECTED', null);
    emitter.emit('ON_LINE_ADD_NEW', null);
  }

  // 取消编辑
  // 添加线: 取消添加, 销毁所有已添加的部分
  // 编辑线: 销毁当前编辑的内容，并重新从缓存数据生成
  cancleLine() {
    // 添加/编辑:销毁缓存中的内容
    if (this.editing && this.newLine) {
      this.newLine.points.forEach((p) => {
        p.dispose();
      });
      this.newLine = null;
    }
    // 编辑: 从缓存中获取编辑前数据,并恢复,推入lines
    if (this.editing === 'edit' && this.editBuff) {
      const line = this.editBuff;
      const newLine = {
        ...line,
        uid: _.uniqueId('line_'),
        points: [] // 点集合
      };
      line.points?.forEach((data) => {
        const dom = this.createDom(data, newLine.uid);
        const dot = new TagDot(dom, data);
        this.viewer.renderDot(dot);
        newLine.points.push(dot);
      });
      this.lines.push(newLine);
    }

    this.endLine();
  }

  createDom(entity, lineid) {
    entity.uid = _.uniqueId('linedot_');
    const dom = document.createElement('div');
    dom.className = 'tag-line';
    dom.setAttribute('data-x', entity.x);
    dom.setAttribute('data-y', entity.y);
    dom.setAttribute('data-lineid', lineid);
    dom.setAttribute('data-dotid', entity.uid);

    const icon = document.createElement('img');
    icon.className = 'tag-line__icon';
    icon.src = import.meta.env.VITE_BASE_PATH + 'assets/vr/dot_tag.png';
    icon.setAttribute('draggable', 'false');
    icon.addEventListener('mousedown', this.handleDotMouseDown);
    dom.appendChild(icon);
    return dom;
  }

  updatePosition() {
    if (!this.viewer.isDeviceing) {
      this.lines?.forEach((line) => {
        line.points?.forEach((item) => {
          item.updatePosition(this.viewer.camera);
        });
      });
    }
  }

  handleDrawPointClick(e) {
    if (e.button === 0) {
      // 左键
      const x = e.layerX;
      const y = e.layerY;
      const angles = this.viewer.pixelToAngle(x, y);
      const point = {
        x: angles.lg,
        y: angles.lt
      };

      const dom = this.createDom(point, this.newLine.uid);
      const dot = new TagDot(dom, point);
      this.viewer.renderDot(dot);
      this.newLine.points.push(dot);
      emitter.emit('ON_LINE_ADD_NEW', this.newLine);
    } else if (e.button === 2) {
      // 右键结束画线
      // this.finishLine()
      // 删除上一个点
      this.removeLast();
    }
  }

  removeLast() {
    if (!this.newLine) return;
    if (!this.newLine.points.length) return;
    const index = this.newLine.points.length - 1;
    const last = this.newLine.points[index];
    last.dispose();
    this.newLine.points.splice(index, 1);
    emitter.emit('ON_LINE_DOT_REMOVE', [
      this.newLine,
      index <= 0 ? null : this.newLine.points[index - 1]
    ]);
  }

  handleDrawPointMove(e) {
    if (this.editing) {
      const x = e.layerX;
      const y = e.layerY;
      this.drawMoveArg = { x, y };
      this.viewer.canvas.style.cursor = 'url(/assets/vr/line_dot.ico) 10 9,default';
    } else {
      this.viewer.canvas.style.cursor = 'default';
    }
  }

  handleDotMouseDown(e) {
    e.cancelBubble = true;
    if (!this.active) return;
    if (this.editing) {
      this.startMove(e);
    } else {
      this.selectLineByDot(e);
    }
  }

  /**
   * 通过鼠标点击节点的dom, 获取线的信息,
   * 并将线的信息提供给UI
   * @param {*} e
   */
  selectLineByDot(e) {
    const target = e.currentTarget.parentNode.dataset;
    // 获取当前点所在的线 并返回前端需要的信息
    const { lineid } = target;
    const line = this.lines.find((x) => x.uid === lineid);
    if (line) {
      emitter.emit('ON_LINE_SELECTED', line);
      emitter.emit('ON_LINE_ITEM_SELECTED', line);
    }
  }

  selectLineById(id) {
    const line = this.lines.find((x) => x.id === id);
    if (line) {
      // 找到line的最后一个点
      const lastPoint = line.points[line.points.length - 1];
      // this.viewer.handleMouseMove(lastPoint.dirAngle.x, lastPoint.dirAngle.y)
      // const { position } = lastPoint.tagMesh
      // this.viewer.camera?.lookAt(position.x, position.y, position.z)
      // this.viewer.setManualRotationByCamera()
      this.viewer.turnCameraToDot(lastPoint);
      this.viewer.updatePosition();
      emitter.emit('ON_LINE_SELECTED', null);
    }
  }

  startMove(e) {
    if (!this.active) return;
    const target = e.currentTarget.parentNode;
    this.mouse.initX = parseFloat(target.dataset.x);
    this.mouse.initY = parseFloat(target.dataset.y);
    if (this.editing) {
      this.curLine = this.newLine;
    } else {
      this.curLine = this.lines.find((item) => item.uid === target.dataset.lineid);
    }
    if (!this.curLine) return;
    this.curDot = this.curLine.points.find((item) => item.data.uid === target.dataset.dotid);
    if (!this.curDot) return;
    this.mouse.mouseDownX = e.clientX;
    this.mouse.mouseDownY = e.clientY;
    document.addEventListener('mousemove', this.handleDotMouseMove);
    document.addEventListener('mouseup', this.handleDotMouseUp);
  }

  handleDotMouseMove(e) {
    e.cancelBubble = true;
    e.preventDefault();

    if (!this.active) return;
    if (!this.curDot) return;

    const diffX = e.clientX - this.mouse.mouseDownX;
    const diffY = e.clientY - this.mouse.mouseDownY;

    const x = this.mouse.initX + diffX;
    const y = this.mouse.initY + diffY;

    const angles = this.viewer.pixelToAngle(x, y);
    this.curDot.setDirAngle(angles.lg, angles.lt);
    this.curDot.updatePosition(this.viewer.camera);

    emitter.emit('ON_LINE_ADD_NEW', this.newLine);
  }

  handleDotMouseUp(e) {
    if (!this.active) return;

    emitter.emit('ON_LINE_ADD_NEW', this.newLine);

    document.removeEventListener('mousemove', this.handleDotMouseMove);
    document.removeEventListener('mouseup', this.handleDotMouseUp);
  }
}
