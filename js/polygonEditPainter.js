import _ from 'lodash-es';
import { useEmitt } from '@sutpc/portal/src/hooks';
import { SPHERE_RADIUS } from './constants';
import TagDot from './tagDot.js';
import utils from './utils.js';
import { base64ToStr } from '@/utils/base64';

const { emitter } = useEmitt();

export default class PolygonEditPainter {
  constructor(viewer) {
    this.viewer = viewer;
    // 用于控制是否layer可操纵
    this.active = false;
    this.editing = '';
    this.uniqueId = 1;
    this.polygons = [];
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

    this.viewer.canvas.addEventListener('mousemove', this.handleDrawPointMove);
  }

  setActive(active) {
    this.active = active;
  }

  setPolygons(polygons) {
    this.viewer.renderWithThreejs.clear();
    // TODO: CLEAR LINES
    this.polygons.forEach((polygon) => {
      polygon.points?.forEach((dot) => {
        dot.dispose();
      });
    });

    // TODO: RECREATE LINES
    this.polygons = [];
    polygons?.forEach((polygon) => {
      const newPolygon = {
        ...polygon,
        uid: _.uniqueId('polygon_'),
        points: [] // 点集合
      };
      polygon.points?.forEach((data, index) => {
        const dom = this.createDom(data, newPolygon.uid);
        if (index === 0 && polygon.enableTooltip) {
          // 如果是第一个点就添加弹窗
          const tooltip = document.createElement('div');
          tooltip.className = `tag-dot__tooltip tooltip-${polygon.contentSizeType} shengchuang`;
          tooltip.innerHTML = polygon.content ? base64ToStr(polygon.content) : '';
          dom.appendChild(tooltip);
        }
        const dot = new TagDot(dom, data);
        this.viewer.renderDot(dot);
        newPolygon.points.push(dot);
      });
      this.polygons.push(newPolygon);
    });
  }

  dispose() {
    this.polygons?.forEach((polygon) => {
      polygon.points?.forEach((p) => p.dispose());
    });
    this.polygons = [];
    this.tempMesh?.remove();
    if (this.newPolygon) {
      this.newPolygon.points.forEach((p) => {
        p.dispose();
      });
      this.newPolygon = null;
    }
    this.viewer.canvas.removeEventListener('mousemove', this.handleDrawPointMove);
  }

  render() {
    // if (!this.polygons?.length) return
    // 渲染polygon列表
    this.polygons?.forEach((polygon) => {
      // 原渲染方式
      // this.renderPolygon(polygon);
      // 新方式
      this.viewer.renderWithThreejs.renderPolygon(polygon);
      this.renderText(polygon);
    });
    // 渲染正在绘制的polygon
    if (this.newPolygon) {
      // 原渲染方式
      // this.renderPolygon(this.newPolygon);
      // 新方式
      this.viewer.renderWithThreejs.renderPolygon(this.newPolygon);
      this.renderText(this.newPolygon);
    }
  }

  // // 绘制到当前鼠标停留的地方
  // renderDrawingPolygon() {
  //   if (!this.newPolygon) return
  //   if (!this.newPolygon.points.length) return
  //   if (!this.drawMoveArg) return
  //   const path = this.getPolygonPath(this.newPolygon)

  //   const canvas = this.viewer.topCanvas
  //   const ctx = canvas.getContext('2d')

  //   ctx.strokeStyle = '#fff'
  //   ctx.fillStyle = 'rgba(200,200,200,0.7)'
  //   ctx.polygonWidth = 1

  //   ctx.beginPath()
  //   path?.forEach((position, index) => {
  //     if (index === 0) {
  //       ctx.moveTo(position.x, position.y)
  //     } else {
  //       ctx.lineTo(position.x, position.y)
  //     }
  //   })
  //   ctx.stroke()

  //   ctx.strokeStyle = 'blue'
  //   ctx.lineTo(this.drawMoveArg.x, this.drawMoveArg.y)

  //   ctx.closePath()
  //   ctx.fill()
  //   ctx.stroke()
  // }
  setLineDash(type, lineWidth, ctx) {
    const width = lineWidth < 2 ? 2 : lineWidth;
    switch (type) {
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
  }
  renderPolygon(polygon) {
    const path = this.getPolygonPath(polygon);

    const canvas = this.viewer.topCanvas;
    const ctx = canvas.getContext('2d');

    const hover =
      path.length >= 3 && this.drawMoveArg && utils.isPointInPolygon(this.drawMoveArg, path);

    if (hover) {
      ctx.strokeStyle = polygon.lineColorHover || '#fff';
      ctx.fillStyle = polygon.fillColorHover || 'rgba(200,200,200,0.9)';
      ctx.lineWidth = polygon.lineWidthHover || 1;
      // ctx.setLineDash(polygon.lineTypeHover === 'dashed' ? [10, 5] : []);
      this.setLineDash(polygon.lineTypeHover, polygon.lineWidthHover || 1, ctx);
    } else {
      ctx.strokeStyle = polygon.lineColor || '#fff';
      ctx.fillStyle = polygon.fillColor || 'rgba(200,200,200,0.5)';
      ctx.lineWidth = polygon.lineWidth || 1;
      // ctx.setLineDash(polygon.lineType === 'dashed' ? [10, 5] : []);
      this.setLineDash(polygon.lineType, polygon.lineWidth || 1, ctx);
    }

    ctx.beginPath();
    path?.forEach((position, index) => {
      if (index === 0) {
        ctx.moveTo(position.x, position.y);
      } else {
        ctx.lineTo(position.x, position.y);
      }
    });
    ctx.closePath();
    ctx.stroke();
    ctx.fill();

    this.renderText(polygon);
  }

  renderText(polygon) {
    if (!polygon.showContent) return;
    // 找到最后一个屏幕内的点
    const point = _.findLast(
      polygon.points,
      (p) => !utils.isOffScreen(p.tagMesh, this.viewer.camera)
    );
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
      ctx.fillText(polygon.title, position.x, position.y + 30);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    }
  }

  getPolygonPath(polygon) {
    // 存放绘制过程中产生的每个点
    const path = [];
    // render polygon
    for (let i = 0; i < polygon.points.length - 1; i++) {
      const p1 = polygon.points[i];
      const p2 = polygon.points[i + 1];
      // 判断2个点是否在屏幕外
      const isOffScreen1 = utils.isOffScreen(p1.tagMesh, this.viewer.camera);
      const isOffScreen2 = utils.isOffScreen(p2.tagMesh, this.viewer.camera);
      if (isOffScreen1 && isOffScreen2) {
        // 均不可见, 不画线
        continue;
      } else if (!isOffScreen1 && !isOffScreen2) {
        // 都可见,直接二者相连
        const [position1, position2] = this.getFullLinePos(p1.tagMesh, p2.tagMesh);
        path.push(position1, position2);
      } else if (isOffScreen1 && !isOffScreen2) {
        // A不可见 B可见, 从B连到A/B最近的可见插值点
        const [position1, position2] = this.getPartialLinePos(p2, p1);
        path.push(position2, position1);
      } else if (!isOffScreen1 && isOffScreen2) {
        // A可见 B不可见, 从A连到A/B最近的可见插值点
        const [position1, position2] = this.getPartialLinePos(p1, p2);
        path.push(position1, position2);
      }
    }
    return path;
  }

  getFullLinePos(mesh1, mesh2) {
    const position1 = this.toScreenPosition(mesh1);
    const position2 = this.toScreenPosition(mesh2);
    return [position1, position2];
  }

  /**
   * 绘制一端在屏幕外的情况
   * p1: 可见点
   * p2: 不可见点
   */
  getPartialLinePos(p1, p2) {
    // 获取插值后的最新点
    const angle = this.getInterpolateAngle(p1.dirAngle, p2.dirAngle);
    this.setMeshAngle(angle);
    return this.getFullLinePos(p1.tagMesh, this.tempMesh);
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
    const title = `面标记${this.uniqueId}`;
    this.uniqueId++;
    const finded = this.polygons.find((x) => x.title === title);
    return finded ? this.getTitle() : title;
  }

  startAddPolygon() {
    // 开启描点
    this.editing = 'add';
    this.viewer.mouseControl.setActive(false);
    this.viewer.canvas.style.cursor = 'url(/assets/vr/line_dot.ico) 10 9,default';
    // 构造存储结构用于接下来填充
    this.newPolygon = {
      uid: _.uniqueId('polygon_'),
      title: this.getTitle(),
      type: 'shape',
      showContent: false,
      lineColor: '#ffffff',
      lineType: 'solid',
      lineWidth: 1,
      fillColor: 'rgba(200,200,200,0.9)',
      lineColorHover: '#ffffff',
      lineTypeHover: 'solid',
      lineWidthHover: 1,
      fillColorHover: 'rgba(200,200,200,0.5)',
      points: [] // 点集合
    };

    this.viewer.canvas.addEventListener('mousedown', this.handleDrawPointClick);
  }

  startEditPolygon(polygonid) {
    this.editing = 'edit';
    const index = this.polygons.findIndex((x) => x.uid === polygonid);
    if (index < 0) return;
    this.newPolygon = this.polygons.splice(index, 1)[0];
    // 用于缓存
    this.editBuff = {
      ...this.newPolygon,
      points: this.newPolygon.points.map((x) => ({ ...x.data }))
    };
    this.viewer.mouseControl.setActive(false);
    this.viewer.canvas.style.cursor = 'url(/assets/vr/line_dot.ico) 10 9,default';
    this.viewer.canvas.addEventListener('mousedown', this.handleDrawPointClick);
  }

  finishPolygon() {
    if (this.newPolygon && this.newPolygon.points.length > 1) {
      // 提交有效绘制
      this.polygons.push(this.newPolygon);
      const data = {
        ...this.newPolygon,
        points: this.newPolygon.points.map((x) => x.data)
      };
      if (this.editing === 'add') {
        emitter.emit('CREATE_POLYGON_TAG_DATA', data);
      } else if (this.editing === 'edit') {
        emitter.emit('UPDATE_POLYGON_TAG_DATA', data);
      }
      // 缓存设为空, 后续cancle过程不会dispose相关资源
      this.newPolygon = null;
    }
    this.endPolygon();
  }

  canclePolygon() {
    // 添加/编辑:销毁缓存中的内容
    if (this.editing && this.newPolygon) {
      this.newPolygon.points.forEach((p) => {
        p.dispose();
      });
      this.newPolygon = null;
    }
    // 编辑: 从缓存中获取编辑前数据,并恢复,推入polygons
    if (this.editing === 'edit' && this.editBuff) {
      const polygon = this.editBuff;
      const newPolygon = {
        ...polygon,
        uid: _.uniqueId('polygon_'),
        points: [] // 点集合
      };
      polygon.points?.forEach((data) => {
        const dom = this.createDom(data, newPolygon.uid);
        const dot = new TagDot(dom, data);
        this.viewer.renderDot(dot);
        newPolygon.points.push(dot);
      });
      this.polygons.push(newPolygon);
    }
    this.endPolygon();
  }

  // 结束绘制,恢复现场
  endPolygon() {
    if (this.drawMoveArg) {
      this.drawMoveArg = null;
    }

    // 恢复现场
    this.editing = '';
    this.editBuff = null;
    this.viewer.mouseControl.setActive(true);
    this.viewer.canvas.style.cursor = 'default';
    this.viewer.canvas.removeEventListener('mousedown', this.handleDrawPointClick);

    emitter.emit('ON_POLYGON_SELECTED', null);
    emitter.emit('ON_POLYGON_ADD_NEW', null);
  }

  createDom(entity, polygonid) {
    entity.uid = _.uniqueId('polygondot_');
    const dom = document.createElement('div');
    dom.className = 'tag-polygon';
    dom.setAttribute('data-x', entity.x);
    dom.setAttribute('data-y', entity.y);
    dom.setAttribute('data-polygonid', polygonid);
    dom.setAttribute('data-dotid', entity.uid);

    const icon = document.createElement('img');
    icon.className = 'tag-polygon__icon';
    icon.src = import.meta.env.VITE_BASE_PATH + 'assets/vr/dot_tag.png';
    icon.setAttribute('draggable', 'false');
    icon.addEventListener('mousedown', this.handleDotMouseDown);
    dom.appendChild(icon);
    return dom;
  }

  updatePosition() {
    if (!this.viewer.isDeviceing) {
      this.polygons?.forEach((polygon) => {
        polygon.points?.forEach((item) => {
          item.updatePosition(this.viewer.camera);
        });
      });
    }
  }

  handleDrawPointClick(e) {
    if (e.button === 0) {
      // 左键
      this.viewer.canvas.style.cursor = 'url(/assets/vr/line_dot.ico) 10 9,default';

      const x = e.layerX;
      const y = e.layerY;
      const angles = this.viewer.pixelToAngle(x, y);
      const point = {
        x: angles.lg,
        y: angles.lt
      };

      const dom = this.createDom(point, this.newPolygon.uid);
      const dot = new TagDot(dom, point);
      this.viewer.renderDot(dot);
      this.newPolygon.points.push(dot);
      emitter.emit('ON_POLYGON_ADD_NEW', this.newPolygon);
    } else if (e.button === 2) {
      // 右键结束画线
      // this.finishPolygon()
      // TODO: 删除上一个点
      this.removeLast();
    }
  }

  removeLast() {
    if (!this.newPolygon) return;
    if (!this.newPolygon.points.length) return;
    const index = this.newPolygon.points.length - 1;
    const last = this.newPolygon.points[index];
    last.dispose();
    this.newPolygon.points.splice(index, 1);
    emitter.emit('ON_POLYGON_DOT_REMOVE', [
      this.newPolygon,
      index <= 0 ? null : this.newPolygon.points[index - 1]
    ]);
  }

  handleDrawPointMove(e) {
    const x = e.layerX;
    const y = e.layerY;
    this.drawMoveArg = { x, y };
  }

  handleDotMouseDown(e) {
    e.cancelBubble = true;
    if (!this.active) return;
    if (this.editing) {
      this.startMove(e);
    } else {
      this.selectPolygonByDot(e);
    }
  }

  /**
   * 通过鼠标点击节点的dom, 获取线的信息,
   * 并将线的信息提供给UI
   * @param {*} e
   */
  selectPolygonByDot(e) {
    const target = e.currentTarget.parentNode.dataset;
    // 获取当前点所在的线 并返回前端需要的信息
    const { polygonid } = target;
    const polygon = this.polygons.find((x) => x.uid === polygonid);
    if (polygon) {
      emitter.emit('ON_POLYGON_SELECTED', polygon);
      emitter.emit('ON_POLYGON_ITEM_SELECTED', polygon);
    }
  }

  selectPolygonById(id) {
    const polygon = this.polygons.find((x) => x.id === id);
    if (polygon) {
      const lastPoint = polygon.points[polygon.points.length - 1];
      // this.viewer.handleMouseMove(lastPoint.dirAngle.x, lastPoint.dirAngle.y)
      // const { position } = lastPoint.tagMesh
      // this.viewer.camera?.lookAt(position.x, position.y, position.z)
      // this.viewer.setManualRotationByCamera()
      this.viewer.turnCameraToDot(lastPoint);
      this.viewer.updatePosition();
      emitter.emit('ON_POLYGON_SELECTED', null);
    }
  }

  startMove(e) {
    if (!this.active) return;
    const target = e.currentTarget.parentNode;
    this.mouse.initX = parseFloat(target.dataset.x);
    this.mouse.initY = parseFloat(target.dataset.y);
    // this.curPolygon = this.polygons.find((item) => item.uid === target.dataset.polygonid)
    if (this.editing) {
      this.curPolygon = this.newPolygon;
    } else {
      this.curPolygon = this.polygons.find((item) => item.uid === target.dataset.polygonid);
    }
    if (!this.curPolygon) return;
    this.curDot = this.curPolygon.points.find((item) => item.data.uid === target.dataset.dotid);
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

    emitter.emit('ON_POLYGON_ADD_NEW', this.newPolygon);
  }

  handleDotMouseUp(e) {
    if (!this.active) return;
    emitter.emit('ON_POLYGON_ADD_NEW', this.newPolygon);

    // // TODO: receive this cmd & handle update
    // emitter.emit('UPDATE_POLYGON_TAG_DATA', this.curPolygon, this.curDot.data)
    document.removeEventListener('mousemove', this.handleDotMouseMove);
    document.removeEventListener('mouseup', this.handleDotMouseUp);
  }
}
